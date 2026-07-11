import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { C, S } from "@/src/theme";

const ICONS: any = {
  follow: "person-add",
  friend_request: "people",
  friend_accept: "star",
  default: "notifications",
};

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const n = await api.get("/notifications");
        setNotes(n);
        await api.post("/notifications/read");
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="notifications-back">
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: S.lg }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={56} color={C.muted} />
              <Text style={styles.emptyText}>Nothing here yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, !item.read && styles.unread]}>
              <View style={styles.iconWrap}>
                <Ionicons name={ICONS[item.type] || ICONS.default} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.md, marginBottom: S.sm },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md, borderBottomWidth: 0.5, borderBottomColor: C.border },
  unread: { backgroundColor: "rgba(79,70,229,0.08)", borderRadius: 8, paddingHorizontal: S.sm },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontSize: 15 },
  time: { color: C.muted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { color: C.muted, marginTop: S.md, fontSize: 15 },
});
