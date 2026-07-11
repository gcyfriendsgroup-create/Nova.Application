import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "@/src/theme";

export default function Avatar({
  uri,
  name = "?",
  size = 48,
  ring = false,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  ring?: boolean;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const inner = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: C.surface3,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "700" }}>{initial}</Text>
      )}
    </View>
  );

  if (!ring) return inner;

  return (
    <LinearGradient
      colors={[C.brandBlue, C.brandPurple]}
      style={{
        width: size + 8,
        height: size + 8,
        borderRadius: (size + 8) / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ padding: 2, backgroundColor: C.surface, borderRadius: (size + 4) / 2 }}>
        {inner}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({});
