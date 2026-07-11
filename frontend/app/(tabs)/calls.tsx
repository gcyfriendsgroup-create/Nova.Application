import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { useCall } from "@/src/CallContext";
import { api } from "@/src/api";
import { C, S, R, textOn, mutedOn, cardOn } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import Starfield from "@/src/components/Starfield";

export default function CallsTab() {
  const { user } = useAuth();
  const { startCall } = useCall();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bg = user?.page_color || C.surface;
  const fg = textOn(bg);
  const dim = mutedOn(bg);

  const load = useCallback(async () => {
    try {
      const [h, f] = await Promise.all([api.get("/calls"), api.get("/friends")]);
      setHistory(h);
      setFriends(f);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const call = (friend: any, type: string) => {
    startCall(
      { id: friend.id, name: friend.display_name, avatar: friend.avatar },
      type as "voice" | "video"
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {bg === C.surface && <Starfield count={60} />}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: fg }]}>Calls</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 120 }}>
          <Text style={[styles.section, { color: dim }]}>CALL A FRIEND</Text>
          {friends.length === 0 ? (
            <Text style={[styles.hint, { color: dim }]}>Add friends to start calling them.</Text>
          ) : (
            friends.map((f) => (
              <View key={f.id} style={[styles.row, { backgroundColor: cardOn(bg) }]}>
                <Avatar uri={f.avatar} name={f.display_name} size={48} />
                <Text style={[styles.name, { color: fg }]}>{f.display_name}</Text>
                <Pressable onPress={() => call(f, "voice")} testID={`voice-call-${f.id}`} style={styles.callBtn}>
                  <Ionicons name="call" size={20} color={C.success} />
                </Pressable>
                <Pressable onPress={() => call(f, "video")} testID={`video-call-${f.id}`} style={styles.callBtn}>
                  <Ionicons name="videocam" size={22} color={C.brandBlue} />
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.section, { color: dim, marginTop: S.xl }]}>RECENT</Text>
          {history.length === 0 ? (
            <Text style={[styles.hint, { color: dim }]}>No recent calls.</Text>
          ) : (
            history.map((h) => (
              <View key={h.id} style={styles.histRow}>
                <Avatar uri={h.other_user?.avatar} name={h.other_user?.display_name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: fg }]}>{h.other_user?.display_name || "Unknown"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons
                      name={h.direction === "outgoing" ? "arrow-up-outline" : "arrow-down-outline"}
                      size={13}
                      color={h.status === "declined" ? C.error : dim}
                    />
                    <Text style={[styles.hist, { color: dim }]}>
                      {h.direction} · {h.call_type} · {h.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: S.lg, paddingBottom: S.sm },
  title: { fontSize: 28, fontWeight: "800" },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: S.sm },
  hint: { fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    marginBottom: S.sm,
  },
  name: { fontSize: 16, fontWeight: "700", flex: 1 },
  callBtn: { padding: 8 },
  histRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.sm },
  hist: { fontSize: 13, textTransform: "capitalize" },
});
