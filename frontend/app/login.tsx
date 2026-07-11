import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/AuthContext";
import NovaLogo from "@/src/components/NovaLogo";
import Starfield from "@/src/components/Starfield";
import { C, S, R } from "@/src/theme";

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const googleLogin = async () => {
    setErr("");
    try {
      await loginWithGoogle();
    } catch (e: any) {
      setErr(e.message || "Google sign-in failed");
    }
  };

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/story");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Starfield count={90} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <NovaLogo size={110} />
        <Text style={styles.title}>Nova</Text>
        <Text style={styles.tag}>Chat · Call · Connect across the galaxy</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="login-email-input"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="login-password-input"
        />
        {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

        <Pressable style={styles.btn} onPress={submit} disabled={busy} testID="login-submit-button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log in</Text>}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <Pressable style={styles.googleBtn} onPress={googleLogin} testID="google-login-button">
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>

        <Link href="/register" asChild>
          <Pressable testID="go-register-button">
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  inner: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xl },
  title: { color: "#fff", fontSize: 38, fontWeight: "800", letterSpacing: 2, marginTop: 10 },
  tag: { color: C.muted, fontSize: 14, marginBottom: S["2xl"], marginTop: 4 },
  input: {
    width: "100%",
    backgroundColor: C.surface2,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  btn: {
    width: "100%",
    backgroundColor: C.brand,
    borderRadius: R.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: S.sm,
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", width: "100%", marginVertical: S.lg, gap: S.md },
  divider: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.muted, fontSize: 13 },
  googleBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    backgroundColor: C.surface3,
    borderRadius: R.md,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  googleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: C.brandPurple, marginTop: S.xl, fontSize: 15 },
  err: { color: C.error, marginBottom: S.sm, alignSelf: "flex-start" },
});
