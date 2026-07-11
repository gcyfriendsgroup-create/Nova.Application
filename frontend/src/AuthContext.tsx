import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Notifications from "expo-notifications";
import { storage } from "@/src/utils/storage";
import { api, setAuthToken, wsUrl } from "@/src/api";

const TOKEN_KEY = "nova_token";

function extractSessionId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[#?&]session_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type User = any;
type Listener = (event: string, payload: any) => void;

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
  subscribe: (fn: Listener) => () => void;
  sendWs: (data: any) => void;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const tokenRef = useRef<string | null>(null);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const sendWs = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connectWs = useCallback((token: string) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(wsUrl(token));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        listeners.current.forEach((fn) => fn(msg.event, msg.payload));
      } catch {}
    };
    ws.onclose = () => {
      // simple reconnect
      setTimeout(() => {
        if (tokenRef.current) connectWs(tokenRef.current);
      }, 3000);
    };
    wsRef.current = ws;
  }, []);

  const persist = useCallback(
    async (token: string, u: User) => {
      tokenRef.current = token;
      setAuthToken(token);
      await storage.secureSet(TOKEN_KEY, token);
      setUser(u);
      connectWs(token);
    },
    [connectWs]
  );

  const processSessionId = useCallback(
    async (sessionId: string) => {
      const r = await api.post("/auth/google", { session_id: sessionId });
      await persist(r.token, r.user);
    },
    [persist]
  );

  const loginWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = extractSessionId(result.url);
      if (sid) await processSessionId(sid);
    }
  }, [processSessionId]);

  const bootstrap = useCallback(async () => {
    // 1) Handle OAuth redirect (web hash/query, or mobile cold-start deep link)
    try {
      if (Platform.OS === "web") {
        const sid = extractSessionId(window.location.href);
        if (sid) {
          await processSessionId(sid);
          window.history.replaceState(null, "", window.location.pathname);
          setLoading(false);
          return;
        }
      } else {
        const initial = await Linking.getInitialURL();
        const sid = initial ? extractSessionId(initial) : null;
        if (sid) {
          await processSessionId(sid);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // 2) Restore an existing session
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) {
      tokenRef.current = token;
      setAuthToken(token);
      try {
        const me = await api.get("/auth/me");
        setUser(me);
        connectWs(token);
      } catch {
        setAuthToken(null);
        await storage.secureRemove(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, [connectWs, processSessionId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Register device for push notifications once authenticated (native only)
  useEffect(() => {
    if (Platform.OS === "web" || !user?.id) return;
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const tokenResp = await Notifications.getDevicePushTokenAsync();
        await api.post("/register-push", {
          user_id: user.id,
          platform: Platform.OS,
          device_token: tokenResp.data,
        });
      } catch {}
    })();
  }, [user?.id]);

  // Mobile: handle hot deep links returning a session_id
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) processSessionId(sid).catch(() => {});
    });
    return () => sub.remove();
  }, [processSessionId]);

  const login = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    await persist(r.token, r.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const r = await api.post("/auth/register", {
      email,
      password,
      display_name: name,
    });
    await persist(r.token, r.user);
  };

  const logout = async () => {
    tokenRef.current = null;
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    wsRef.current?.close();
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.get("/auth/me");
    setUser(me);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
        setUser,
        subscribe,
        sendWs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
