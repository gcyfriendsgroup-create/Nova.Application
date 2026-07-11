import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Vibration } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import Starfield from "@/src/components/Starfield";

function Ring({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + p.value * 1.7 }],
    opacity: 0.5 * (1 - p.value),
  }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

export default function CallScreen() {
  const params = useLocalSearchParams<{ calleeId: string; name: string; avatar: string; type: string }>();
  const { subscribe } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState("Calling…");
  const callIdRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    Vibration.vibrate([0, 400, 800], true);
    (async () => {
      try {
        const call = await api.post("/calls", { callee_id: params.calleeId, call_type: params.type || "voice" });
        callIdRef.current = call.id;
      } catch {
        setStatus("Call failed");
      }
    })();
    timerRef.current = setTimeout(() => {
      setStatus("No answer");
      hangup("end");
    }, 30000);

    const unsub = subscribe((event) => {
      if (event === "call_accepted") {
        setStatus("Connected");
        Vibration.cancel();
      } else if (event === "call_declined") {
        setStatus("Declined");
        finish();
      } else if (event === "call_ended") {
        finish();
      }
    });
    return () => {
      unsub();
      Vibration.cancel();
      clearTimeout(timerRef.current);
    };
  }, []);

  const finish = () => {
    Vibration.cancel();
    clearTimeout(timerRef.current);
    setTimeout(() => router.back(), 800);
  };

  const hangup = async (action: string) => {
    if (callIdRef.current) {
      try { await api.post(`/calls/${callIdRef.current}/${action}`); } catch {}
    }
    finish();
  };

  return (
    <View style={styles.container} testID="outgoing-call-screen">
      <Starfield count={70} />
      <View style={styles.center}>
        <Ring delay={0} color={C.brandBlue} />
        <Ring delay={700} color={C.brandPurple} />
        <Ring delay={1400} color={C.brandBlue} />
        <Avatar uri={params.avatar || undefined} name={params.name} size={120} />
      </View>
      <Text style={styles.name}>{params.name}</Text>
      <Text style={styles.status}>{status}</Text>
      <Pressable style={styles.hangup} onPress={() => hangup("end")} testID="hangup-button">
        <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  subtitle: { color: C.muted, fontSize: 16, position: "absolute", top: 90 },
  center: { alignItems: "center", justifyContent: "center", height: 240, marginBottom: 30 },
  ring: { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2 },
  name: { color: "#fff", fontSize: 30, fontWeight: "800" },
  status: { color: C.brandPurple, fontSize: 16, marginTop: S.sm, marginBottom: S["3xl"] },
  hangup: { backgroundColor: C.error, width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
});
