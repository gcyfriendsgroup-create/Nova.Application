import React, { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { C, S, R } from "@/src/theme";

// Lightweight animated toast: slides up + fades, auto-hides after ~2s.
export default function Toast({
  message,
  icon = "checkmark-circle",
  onHide,
}: {
  message: string | null;
  icon?: any;
  onHide: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (message) {
      progress.value = withSequence(
        withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
        withDelay(
          1900,
          withTiming(0, { duration: 240, easing: Easing.in(Easing.ease) }, (finished) => {
            if (finished) runOnJS(onHide)();
          })
        )
      );
    }
  }, [message]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 30 }, { scale: 0.9 + progress.value * 0.1 }],
  }));

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, style]} pointerEvents="none" testID="app-toast">
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.brand,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderRadius: R.pill,
    shadowColor: C.brandPurple,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    maxWidth: "88%",
  },
  text: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
