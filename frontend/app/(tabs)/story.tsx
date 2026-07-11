import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S, R, textOn, mutedOn, cardOn } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import Starfield from "@/src/components/Starfield";

const { width } = Dimensions.get("window");

export default function StoryTab() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const bg = user?.page_color || C.surface;
  const fg = textOn(bg);
  const dim = mutedOn(bg);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/stories");
      setData(d);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const myGroup = data.find((g) => g.is_me);
  const others = data.filter((g) => !g.is_me);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {bg === C.surface && <Starfield count={70} />}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: fg }]}>Stories</Text>
        <View style={{ flexDirection: "row", gap: S.md }}>
          <Pressable onPress={() => router.push("/people")} testID="open-people-button">
            <Ionicons name="people-outline" size={26} color={fg} />
          </Pressable>
          <Pressable onPress={() => router.push("/notifications")} testID="open-notifications-button">
            <Ionicons name="notifications-outline" size={26} color={fg} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: S.lg, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={fg} />
          }
        >
          {/* Story tray */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.lg, paddingVertical: S.sm }}>
            <Pressable style={styles.trayItem} onPress={() => router.push("/story/create")} testID="add-story-button">
              <View style={styles.addWrap}>
                <Avatar uri={user?.avatar} name={user?.display_name} size={64} />
                <View style={styles.addBadge}>
                  <Ionicons name="add" size={16} color="#fff" />
                </View>
              </View>
              <Text style={[styles.trayName, { color: fg }]}>Your story</Text>
            </Pressable>

            {others.map((g, i) => (
              <Pressable
                key={g.user.id}
                style={styles.trayItem}
                onPress={() => router.push({ pathname: "/story/view", params: { uid: g.user.id } })}
                testID={`story-ring-${g.user.id}`}
              >
                <Avatar uri={g.user.avatar} name={g.user.display_name} size={64} ring />
                <Text style={[styles.trayName, { color: fg }]} numberOfLines={1}>
                  {g.user.display_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Feed */}
          {others.length === 0 && !myGroup ? (
            <View style={styles.empty}>
              <Ionicons name="telescope-outline" size={64} color={dim} />
              <Text style={[styles.emptyText, { color: dim }]}>
                No stories yet. Post one for your friends to see!
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {[...(myGroup ? [myGroup] : []), ...others].map((g) =>
                g.stories.map((s: any) => (
                  <Pressable
                    key={s.id}
                    style={[styles.card, { backgroundColor: cardOn(bg) }]}
                    onPress={() => router.push({ pathname: "/story/view", params: { uid: g.user.id } })}
                  >
                    {s.media_type === "image" ? (
                      <Image source={{ uri: s.media }} style={styles.cardImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.cardImg, styles.videoCard]}>
                        <Ionicons name="play-circle" size={40} color="#fff" />
                      </View>
                    )}
                    <View style={styles.cardFooter}>
                      <Avatar uri={g.user.avatar} name={g.user.display_name} size={22} />
                      <Text style={styles.cardName} numberOfLines={1}>{g.user.display_name}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_W = (width - S.lg * 2 - S.md) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: S.lg,
    paddingBottom: S.sm,
  },
  title: { fontSize: 28, fontWeight: "800" },
  trayItem: { alignItems: "center", width: 74 },
  addWrap: { width: 64, height: 64 },
  addBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: C.brand,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.surface,
  },
  trayName: { fontSize: 12, marginTop: 6 },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: S.xl },
  emptyText: { textAlign: "center", marginTop: S.md, fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: S.md, marginTop: S.lg },
  card: { width: CARD_W, borderRadius: R.lg, overflow: "hidden" },
  cardImg: { width: "100%", height: CARD_W * 1.4 },
  videoCard: { backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6, padding: S.sm },
  cardName: { color: "#fff", fontSize: 12, flex: 1 },
});
