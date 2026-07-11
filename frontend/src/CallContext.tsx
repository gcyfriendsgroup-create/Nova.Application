import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Vibration } from "react-native";
import { useAuth } from "./AuthContext";
import { api } from "./api";
import { webrtcAvailable, RTCModule, ICE_CONFIG } from "./webrtc";

export type Peer = { id: string; name: string; avatar?: string | null };
type Status = "idle" | "outgoing" | "incoming" | "active";

const CallContext = createContext<any>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { subscribe, sendWs } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [callId, setCallId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Peer[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);

  const timerRef = useRef<any>(null);
  const outTimeout = useRef<any>(null);
  const endRef = useRef<any>(null);
  const pcRef = useRef<any>(null);
  const localRef = useRef<any>(null);
  const peerRef = useRef<Peer | null>(null);
  const callTypeRef = useRef<"voice" | "video">("voice");

  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // ---- WebRTC (no-ops safely when unavailable, e.g. Expo Go / web) ----
  const cleanupRTC = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    try { localRef.current?.getTracks().forEach((t: any) => t.stop()); } catch {}
    pcRef.current = null;
    localRef.current = null;
    setRemoteStream(null);
    setLocalStream(null);
  }, []);

  const setupWebRTC = useCallback(
    async (isCaller: boolean) => {
      const target = peerRef.current?.id;
      if (!webrtcAvailable || !target) return;
      try {
        const { RTCPeerConnection, mediaDevices } = RTCModule;
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: callTypeRef.current === "video",
        });
        localRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
        pc.addEventListener("track", (e: any) => setRemoteStream(e.streams[0]));
        pc.addEventListener("icecandidate", (e: any) => {
          if (e.candidate) sendWs({ target, event: "webrtc_ice", payload: { candidate: e.candidate } });
        });
        if (isCaller) {
          const offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);
          sendWs({ target, event: "webrtc_offer", payload: { sdp: pc.localDescription } });
        }
      } catch {
        // getUserMedia denied / no devices — keep the call UI, just no media
      }
    },
    [sendWs]
  );

  const reset = useCallback(() => {
    Vibration.cancel();
    clearInterval(timerRef.current);
    clearTimeout(outTimeout.current);
    cleanupRTC();
    setStatus("idle");
    setPeer(null);
    setCallId(null);
    setParticipants([]);
    setMinimized(false);
    setSeconds(0);
    setMuted(false);
    setSpeaker(false);
    setVideoOn(false);
    setSharing(false);
  }, [cleanupRTC]);

  const goActive = useCallback(() => {
    Vibration.cancel();
    clearTimeout(outTimeout.current);
    setStatus("active");
    setSeconds(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  useEffect(() => {
    const unsub = subscribe((event: string, payload: any) => {
      if (event === "call_incoming") {
        setStatus((prev) => {
          if (prev !== "idle") return prev;
          setPeer({
            id: payload.caller.id,
            name: payload.caller.display_name,
            avatar: payload.caller.avatar,
          });
          setCallId(payload.call.id);
          setCallType(payload.call.call_type);
          setVideoOn(payload.call.call_type === "video");
          return "incoming";
        });
      } else if (event === "call_accepted") {
        goActive();
        setupWebRTC(true); // caller creates the offer
      } else if (event === "call_declined" || event === "call_ended") {
        reset();
      } else if (event === "webrtc_offer") {
        (async () => {
          const pc = pcRef.current;
          if (!pc || !webrtcAvailable) return;
          try {
            const { RTCSessionDescription } = RTCModule;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const target = peerRef.current?.id;
            if (target) sendWs({ target, event: "webrtc_answer", payload: { sdp: pc.localDescription } });
          } catch {}
        })();
      } else if (event === "webrtc_answer") {
        (async () => {
          const pc = pcRef.current;
          if (!pc || !webrtcAvailable) return;
          try {
            const { RTCSessionDescription } = RTCModule;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } catch {}
        })();
      } else if (event === "webrtc_ice") {
        (async () => {
          const pc = pcRef.current;
          if (!pc || !webrtcAvailable) return;
          try {
            const { RTCIceCandidate } = RTCModule;
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {}
        })();
      }
    });
    return () => {
      unsub();
    };
  }, [subscribe, goActive, reset, setupWebRTC, sendWs]);

  useEffect(() => {
    if (status === "incoming" || status === "outgoing") {
      Vibration.vibrate([0, 600, 500, 600, 500], true);
    } else {
      Vibration.cancel();
    }
  }, [status]);

  const endCall = useCallback(async () => {
    if (callId) {
      try {
        await api.post(`/calls/${callId}/end`);
      } catch {}
    }
    reset();
  }, [callId, reset]);

  useEffect(() => {
    endRef.current = endCall;
  }, [endCall]);

  const startCall = useCallback((p: Peer, type: "voice" | "video" = "voice") => {
    setPeer(p);
    setCallType(type);
    setStatus("outgoing");
    setParticipants([]);
    setMinimized(false);
    setVideoOn(type === "video");
    (async () => {
      try {
        const call = await api.post("/calls", { callee_id: p.id, call_type: type });
        setCallId(call.id);
      } catch {}
    })();
    clearTimeout(outTimeout.current);
    outTimeout.current = setTimeout(() => {
      endRef.current && endRef.current();
    }, 30000);
  }, []);

  const acceptCall = useCallback(async () => {
    if (callId) {
      try {
        await api.post(`/calls/${callId}/accept`);
      } catch {}
    }
    goActive();
    setupWebRTC(false); // callee waits for the offer
  }, [callId, goActive, setupWebRTC]);

  const declineCall = useCallback(async () => {
    if (callId) {
      try {
        await api.post(`/calls/${callId}/decline`);
      } catch {}
    }
    reset();
  }, [callId, reset]);

  const addParticipants = useCallback(
    async (list: Peer[]) => {
      setParticipants((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        return [...prev, ...list.filter((l) => !ids.has(l.id))];
      });
      for (const f of list) {
        try {
          await api.post("/calls", { callee_id: f.id, call_type: callType });
        } catch {}
      }
    },
    [callType]
  );

  const upgradeToVideo = useCallback(() => {
    setCallType("video");
    setVideoOn(true);
  }, []);

  // Mute toggles local audio track(s)
  useEffect(() => {
    const s = localRef.current;
    if (s) {
      try {
        s.getAudioTracks().forEach((t: any) => (t.enabled = !muted));
      } catch {}
    }
  }, [muted]);

  return (
    <CallContext.Provider
      value={{
        status,
        peer,
        callType,
        callId,
        participants,
        minimized,
        seconds,
        muted,
        speaker,
        videoOn,
        sharing,
        remoteStream,
        localStream,
        webrtcAvailable,
        setMinimized,
        setMuted,
        setSpeaker,
        setVideoOn,
        setSharing,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        addParticipants,
        upgradeToVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
