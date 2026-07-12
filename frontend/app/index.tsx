import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { useAuth } from "@/src/AuthContext";
import NovaLogo from "@/src/components/NovaLogo";
import Starfield from "@/src/components/Starfield";
import { C } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return;
    if (loading) return;

    // setTimeout(0) defers this to the next tick, after React has fully
    // flushed and attached the navigator — the navState.key check alone
    // isn't enough on every platform/build to guarantee the navigator is
    // truly ready to accept a command in the same tick.
    const t = setTimeout(() => {
      if (user) router.replace("/(tabs)/story");
      else router.replace("/login");
    }, 0);
    return () => clearTimeout(t);
  }, [navState?.key, loading, user]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Starfield count={80} />
      <NovaLogo size={130} />
      <Text style={styles.title}>Nova</Text>
      <ActivityIndicator color={C.brandPurple} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 16,
  },
});
