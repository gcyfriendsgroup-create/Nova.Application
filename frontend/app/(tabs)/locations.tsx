import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";
import WorldMap from "@/src/components/WorldMap";

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

  const points: any[] = [];
  if (myLoc) points.push({ id: "me", lat: myLoc.lat, lng: myLoc.lng, self: true, user });
  friends.forEach((f) => points.push({ id: f.user_id, lat: f.lat, lng: f.lng, user: f.user }));

  return (
    <View style={styles.container}>
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
          <WorldMap points={points} />
          <Pressable style={[styles.fab, { bottom: 90 }]} onPress={requestAndShare} testID="refresh-location-button">
            <Ionicons name="navigate" size={22} color="#fff" />
          </Pressable>
        </>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="none">
        <Text style={styles.title}>Live Map</Text>
        <Text style={styles.sub}>See where your friends are</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: S.lg,
    paddingBottom: S.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
  },
  sub: {
    color: "#fff",
    fontSize: 14,
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
  },
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
