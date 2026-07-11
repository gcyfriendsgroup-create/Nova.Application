import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";

// Subtle starfield of little white dots over a dark background.
export default function Starfield({ count = 60 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.7 + 0.15,
      })),
    [count]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: s.top as any,
            left: s.left as any,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: "#FFFFFF",
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}
