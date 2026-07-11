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
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S } from "@/src/theme";
import Avatar from "./Avatar";
import Starfield from "./Starfield";

function Ring({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false)
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + p.value * 1.6 }],
    opacity: 0.5 * (1 - p.value),
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

// Global incoming-call overlay. Listens on the websocket everywhere.
export default function IncomingCall() {
  const { subscribe } = useAuth();
  const [incoming, setIncoming] = useState<any>(null);

  useEffect(() => {
    const unsub = subscribe((event, payload) => {
      if (event === "call_incoming") {
        setIncoming(payload);
      } else if (event === "call_ended" || event === "call_declined") {
        setIncoming(null);
      }
    });
    return () => {
      unsub();
    };
  }, [subscribe]);

  useEffect(() => {
    if (incoming) {
      Vibration.vibrate([0, 600, 400, 600, 400], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [incoming]);

  if (!incoming) return null;

  const caller = incoming.caller;
  const call = incoming.call;

  const decline = async () => {
    try {
      await api.post(`/calls/${call.id}/decline`);
    } catch {}
    setIncoming(null);
  };
  const accept = async () => {
    try {
      await api.post(`/calls/${call.id}/accept`);
    } catch {}
    setIncoming(null);
  };

  return (
    <View style={styles.overlay} testID="incoming-call-overlay">
      <Starfield count={70} />
      <View style={styles.top}>
        <Text style={styles.subtitle}>
          Incoming {call.call_type === "video" ? "video" : "voice"} call
        </Text>
      </View>
      <View style={styles.center}>
        <Ring delay={0} color={C.brandBlue} />
        <Ring delay={700} color={C.brandPurple} />
        <Ring delay={1400} color={C.brandBlue} />
        <Avatar uri={caller?.avatar} name={caller?.display_name} size={120} />
      </View>
      <Text style={styles.name}>{caller?.display_name}</Text>
      <Text style={styles.calling}>Nova · ringing…</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.btn, { backgroundColor: C.error }]} onPress={decline} testID="decline-call-button">
          <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: C.success }]} onPress={accept} testID="accept-call-button">
          <Ionicons name="call" size={30} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 90,
    zIndex: 1000,
  },
  top: { alignItems: "center" },
  subtitle: { color: C.muted, fontSize: 16 },
  center: { alignItems: "center", justifyContent: "center", height: 240, marginTop: 40 },
  name: { color: "#fff", fontSize: 30, fontWeight: "800" },
  calling: { color: C.brandPurple, fontSize: 15, marginTop: S.xs, marginBottom: S.xl },
  actions: { flexDirection: "row", gap: 70 },
  btn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
});
