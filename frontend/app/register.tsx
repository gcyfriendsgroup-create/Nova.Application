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

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("Enter a display name");
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)/story");
    } catch (e: any) {
      setErr(e.message || "Registration failed");
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
        <NovaLogo size={90} />
        <Text style={styles.title}>Join Nova</Text>

        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={C.muted}
          value={name}
          onChangeText={setName}
          testID="register-name-input"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="register-email-input"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="register-password-input"
        />
        {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}

        <Pressable style={styles.btn} onPress={submit} disabled={busy} testID="register-submit-button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create account</Text>}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <Pressable style={styles.googleBtn} onPress={() => loginWithGoogle().catch(() => {})} testID="google-register-button">
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>

        <Link href="/login" asChild>
          <Pressable testID="go-login-button">
            <Text style={styles.link}>Already have an account? Log in</Text>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  inner: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xl },
  title: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 10, marginBottom: S.xl },
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
