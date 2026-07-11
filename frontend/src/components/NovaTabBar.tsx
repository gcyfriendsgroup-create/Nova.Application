import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import NovaLogo from "./NovaLogo";
import { C, S, R } from "@/src/theme";

const ICONS: Record<string, string> = {
  story: "planet",
  chat: "chatbubbles",
  calls: "call",
  locations: "location",
  settings: "settings",
};

export const SIDEBAR_WIDTH = 240;

export default function NovaTabBar({
  state,
  descriptors,
  navigation,
  desktop,
}: BottomTabBarProps & { desktop: boolean }) {
  const insets = useSafeAreaInsets();

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const label = (options.title ?? route.name) as string;
    const focused = state.index === index;
    const base = ICONS[route.name] || "ellipse";
    const iconName = (focused ? base : `${base}-outline`) as any;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return { key: route.key, name: route.name, label, focused, iconName, onPress };
  });

  if (desktop) {
    return (
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <NovaLogo size={34} spin={false} />
          <Text style={styles.brandText}>Nova</Text>
        </View>
        {items.map((it) => (
          <Pressable
            key={it.key}
            onPress={it.onPress}
            style={[styles.sideItem, it.focused && styles.sideItemActive]}
            testID={`tab-${it.name}`}
          >
            <Ionicons name={it.iconName} size={22} color={it.focused ? "#fff" : C.muted} />
            <Text style={[styles.sideLabel, { color: it.focused ? "#fff" : C.muted }]}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.bottomBar, { height: 64 + insets.bottom, paddingBottom: insets.bottom }]}>
      {Platform.OS === "ios" && <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />}
      {items.map((it) => (
        <Pressable key={it.key} onPress={it.onPress} style={styles.bottomItem} testID={`tab-${it.name}`}>
          <Ionicons name={it.iconName} size={24} color={it.focused ? "#fff" : C.muted} />
          <Text style={[styles.bottomLabel, { color: it.focused ? "#fff" : C.muted }]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: C.surface2,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingTop: 28,
    paddingHorizontal: S.md,
    gap: 4,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingHorizontal: S.sm, marginBottom: S.xl },
  brandText: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: 1 },
  sideItem: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: 12, paddingHorizontal: S.md, borderRadius: R.md },
  sideItemActive: { backgroundColor: C.surface3 },
  sideLabel: { fontSize: 16, fontWeight: "600" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(8,11,20,0.96)",
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  bottomItem: { flex: 1, alignItems: "center", justifyContent: "flex-start", gap: 3 },
  bottomLabel: { fontSize: 11, fontWeight: "600" },
});
