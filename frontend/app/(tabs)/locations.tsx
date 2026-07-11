import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

const { width, height } = Dimensions.get("window");
const MAP_BG =
  "https://images.unsplash.com/photo-1700574005887-47134ebde2ba?crop=entropy&cs=srgb&fm=jpg&q=70&w=800";

export default function LocationsTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [perm, setPerm] = useState<string>("undetermined");
  const [myLoc, setMyLoc] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const f = await api.get("/locations/friends");
      setFriends(f);
    } catch {}
    setLoading(false);
  }, []);

  const requestAndShare = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPerm(status);
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      setMyLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      try {
        await api.put("/location", { lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
      load();
    }
  }, [load]);

  useEffect(() => {
    requestAndShare();
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build marker points (self + friends), normalize to map area
  const points: any[] = [];
  if (myLoc) points.push({ id: "me", lat: myLoc.lat, lng: myLoc.lng, self: true, user });
  friends.forEach((f) => points.push({ id: f.user_id, lat: f.lat, lng: f.lng, user: f.user }));

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const areaW = width - 100, areaH = height - 320;

  const pos = (p: any) => {
    const nx = maxLng === minLng ? 0.5 : (p.lng - minLng) / (maxLng - minLng);
    const ny = maxLat === minLat ? 0.5 : (p.lat - minLat) / (maxLat - minLat);
    return { left: 40 + nx * areaW, top: insets.top + 70 + (1 - ny) * areaH };
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: MAP_BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,7,13,0.55)" }]} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Live Map</Text>
        <Text style={styles.sub}>See where your friends are</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 100 }} />
      ) : points.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={64} color={C.muted} />
          <Text style={styles.emptyText}>
            {perm !== "granted"
              ? "Location permission needed to show the map."
              : "No friends are sharing their location yet."}
          </Text>
          <Pressable style={styles.shareBtn} onPress={requestAndShare} testID="share-location-button">
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.shareText}>Share my location</Text>
          </Pressable>
        </View>
      ) : (
        <>
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
          <Pressable style={[styles.fab, { bottom: 90 }]} onPress={requestAndShare} testID="refresh-location-button">
            <Ionicons name="navigate" size={22} color="#fff" />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { paddingHorizontal: S.lg, paddingBottom: S.sm },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  sub: { color: C.onSurface2, fontSize: 14, marginTop: 2 },
  empty: { alignItems: "center", marginTop: 100, paddingHorizontal: S.xl },
  emptyText: { color: C.onSurface2, textAlign: "center", marginTop: S.md, fontSize: 15 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.brand,
    paddingHorizontal: S.xl,
    paddingVertical: 14,
    borderRadius: R.pill,
    marginTop: S.xl,
  },
  shareText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
  fab: {
    position: "absolute",
    right: S.lg,
    backgroundColor: C.brand,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
