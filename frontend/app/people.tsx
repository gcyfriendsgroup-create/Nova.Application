import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import Toast from "@/src/components/Toast";
import AddFriendButton from "@/src/components/AddFriendButton";

export default function People() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([
        api.get(`/users?search=${encodeURIComponent(search)}`),
        api.get("/friends/requests"),
      ]);
      setPeople(u);
      setRequests(r);
    } catch {}
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const follow = async (id: string, isFollowing: boolean) => {
    try {
      if (isFollowing) await api.del(`/follow/${id}`);
      else await api.post(`/follow/${id}`);
      await refreshUser();
    } catch {}
  };

  const addFriend = async (id: string, name: string) => {
    setSent((s) => (s.includes(id) ? s : [...s, id]));
    setToast(`Friend request sent to ${name} 🚀`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await api.post(`/friends/request/${id}`);
    } catch {
      setSent((s) => s.filter((x) => x !== id));
      setToast("Couldn't send request. Try again.");
    }
  };

  const accept = async (reqId: string) => {
    try { await api.post(`/friends/accept/${reqId}`); } catch {}
    await refreshUser();
    load();
  };

  const message = async (id: string) => {
    try {
      const conv = await api.post("/conversations", { type: "dm", participant_ids: [id] });
      router.push({ pathname: "/chat/[id]", params: { id: conv.id } });
    } catch {}
  };

  const renderPerson = ({ item }: { item: any }) => {
    const isFollowing = user?.following?.includes(item.id);
    const isFriend = user?.friends?.includes(item.id);
    return (
      <View style={styles.row}>
        <Pressable style={styles.rowInfo} onPress={() => router.push(`/profile/${item.id}`)} testID={`person-${item.id}`}>
          <Avatar uri={item.avatar} name={item.display_name} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.desc} numberOfLines={1}>
              {isFriend ? "Friend" : item.description || "On Nova"}
            </Text>
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            style={[styles.pill, isFollowing && styles.pillOutline]}
            onPress={() => follow(item.id, isFollowing)}
            testID={`follow-${item.id}`}
          >
            <Text style={[styles.pillText, isFollowing && { color: C.muted }]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
          {isFriend ? (
            <Pressable style={styles.iconBtn} onPress={() => message(item.id)} testID={`message-${item.id}`}>
              <Ionicons name="chatbubble-ellipses" size={20} color={C.brandBlue} />
            </Pressable>
          ) : (
            <AddFriendButton
              sent={sent.includes(item.id)}
              onPress={() => addFriend(item.id, item.display_name)}
              testID={`add-friend-${item.id}`}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="people-back">
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>People</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search people"
          placeholderTextColor={C.muted}
          testID="people-search-input"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: S.lg }}
          renderItem={renderPerson}
          ListHeaderComponent={
            requests.length > 0 ? (
              <View style={{ marginBottom: S.md }}>
                <Text style={styles.section}>Friend requests</Text>
                {requests.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Avatar uri={r.from_user?.avatar} name={r.from_user?.display_name} size={44} />
                      <Text style={styles.name}>{r.from_user?.display_name}</Text>
                    </View>
                    <Pressable style={styles.pill} onPress={() => accept(r.id)} testID={`accept-friend-${r.id}`}>
                      <Text style={styles.pillText}>Accept</Text>
                    </Pressable>
                  </View>
                ))}
                <Text style={[styles.section, { marginTop: S.md }]}>Discover</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.hint}>No people found.</Text>}
        />
      )}
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.md, marginBottom: S.md },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    backgroundColor: C.surface2,
    marginHorizontal: S.lg,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    marginBottom: S.md,
  },
  searchInput: { flex: 1, color: "#fff", paddingVertical: 12, fontSize: 15 },
  section: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: S.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: S.sm, gap: S.sm },
  rowInfo: { flexDirection: "row", alignItems: "center", gap: S.md, flex: 1 },
  name: { color: "#fff", fontSize: 16, fontWeight: "700" },
  desc: { color: C.muted, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: S.sm },
  pill: { backgroundColor: C.brand, paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.pill },
  pillOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.borderStrong },
  pillText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  iconBtn: { padding: 8 },
  hint: { color: C.muted, textAlign: "center", marginTop: 40 },
});
