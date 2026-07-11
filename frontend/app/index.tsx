import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/AuthContext";
import NovaLogo from "@/src/components/NovaLogo";
import Starfield from "@/src/components/Starfield";
import { C } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace("/(tabs)/story");
      else router.replace("/login");
    }
  }, [loading, user]);

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
