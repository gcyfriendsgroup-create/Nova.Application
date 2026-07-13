import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { C, S } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

const { width, height } = Dimensions.get("window");
const MAP_BG =
  "https://images.unsplash.com/photo-1700574005887-47134ebde2ba?crop=entropy&cs=srgb&fm=jpg&q=70&w=800";

type Point = { id: string; lat: number; lng: number; self?: boolean; user?: any };

// NOTE: this is a stylized placeholder, not a real interactive map. A real
// native map needs react-native-maps, which requires a native rebuild
// (EAS build / Xcode / Android Studio) to verify — out of scope for a
// web-only deploy. The web version (WorldMap.web.tsx) uses a real
// OpenStreetMap-based map instead.
export default function WorldMap({ points }: { points: Point[] }) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const areaW = width - 100, areaH = height - 320;

  const pos = (p: Point) => {
    const nx = maxLng === minLng ? 0.5 : (p.lng - minLng) / (maxLng - minLng);
    const ny = maxLat === minLat ? 0.5 : (p.lat - minLat) / (maxLat - minLat);
    return { left: 40 + nx * areaW, top: 70 + (1 - ny) * areaH };
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: MAP_BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,7,13,0.55)" }]} />
      {points.map((p) => {
        const { left, top } = pos(p);
        return (
          <View key={p.id} style={[styles.marker, { left, top }]} testID={`map-marker-${p.id}`}>
            <View style={[styles.pulse, p.self && { borderColor: C.brandBlue }]} />
            <Avatar uri={p.user?.avatar} name={p.user?.display_name} size={44} ring={p.self} />
            <Text style={styles.markerName}>{p.self ? "You" : p.user?.display_name}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  marker: { position: "absolute", alignItems: "center", width: 80, marginLeft: -40 },
  pulse: {
    position: "absolute",
    top: -6,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: C.brandPurple,
    opacity: 0.6,
  },
  markerName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 6,
    borderRadius: 6,
  },
});
