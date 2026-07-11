import React, { useEffect } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { C, S, R } from "@/src/theme";

// Add-friend control that morphs into an animated "Requested" badge on send.
export default function AddFriendButton({
  sent,
  onPress,
  testID,
  full = false,
}: {
  sent: boolean;
  onPress: () => void;
  testID?: string;
  full?: boolean;
}) {
  const pop = useSharedValue(sent ? 1 : 0);

  useEffect(() => {
    pop.value = sent
      ? withSpring(1, { damping: 20, stiffness: 220, mass: 0.6 })
      : withTiming(0, { duration: 120 });
  }, [sent]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    opacity: pop.value,
  }));

  if (sent) {
    return (
      <Animated.View
        style={[full ? styles.fullBadge : styles.badge, checkStyle]}
        testID={testID ? `${testID}-sent` : undefined}
      >
        <Ionicons name="checkmark-circle" size={18} color={C.success} />
        <Text style={styles.badgeText}>Requested</Text>
      </Animated.View>
    );
  }

  return (
    <Pressable style={full ? styles.fullBtn : styles.iconBtn} onPress={onPress} testID={testID}>
      <Ionicons name="person-add" size={full ? 18 : 20} color="#fff" />
      {full && <Text style={styles.fullText}>  Add friend</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
  },
  badgeText: { color: C.success, fontWeight: "700", fontSize: 12 },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface3,
    paddingHorizontal: S.lg,
    paddingVertical: 12,
    borderRadius: R.pill,
  },
  fullText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fullBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: S.lg,
    paddingVertical: 12,
    borderRadius: R.pill,
  },
});
