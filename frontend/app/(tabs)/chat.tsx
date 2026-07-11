import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S, R, textOn, mutedOn, cardOn } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import Starfield from "@/src/components/Starfield";

export default function ChatTab() {
  const { user, subscribe } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bg = user?.page_color || C.surface;
  const fg = textOn(bg);
  const dim = mutedOn(bg);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/conversations");
      setConvs(d);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const unsub = subscribe((event) => {
      if (event === "message") load();
    });
    return () => { unsub(); };
  }, [subscribe, load]);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {bg === C.surface && <Starfield count={60} />}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: fg }]}>Chats</Text>
        <View style={{ flexDirection: "row", gap: S.md }}>
          <Pressable onPress={() => router.push("/group/create")} testID="create-group-button">
            <Ionicons name="people-circle-outline" size={28} color={fg} />
          </Pressable>
          <Pressable onPress={() => router.push("/people")} testID="new-chat-button">
            <Ionicons name="create-outline" size={26} color={fg} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 60 }} />
      ) : convs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="planet-outline" size={64} color={dim} />
          <Text style={[styles.emptyText, { color: dim }]}>
            No conversations yet. Tap the pencil to start chatting.
          </Text>
        </View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: S.md, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: cardOn(bg) }]}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
              testID={`conversation-${item.id}`}
            >
              {item.type === "group" ? (
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={24} color="#fff" />
                </View>
              ) : (
                <Avatar uri={item.display_avatar} name={item.display_name} size={52} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: fg }]} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <Text style={[styles.preview, { color: dim }]} numberOfLines={1}>
                  {item.last_message || (item.type === "group" ? "Group created" : "Say hi 👋")}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

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
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: S.xl },
  emptyText: { textAlign: "center", marginTop: S.md, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    marginBottom: S.sm,
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 16, fontWeight: "700" },
  preview: { fontSize: 14, marginTop: 2 },
});
