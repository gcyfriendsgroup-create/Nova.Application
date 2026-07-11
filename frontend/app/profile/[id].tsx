import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/AuthContext";
import { useCall } from "@/src/CallContext";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import Starfield from "@/src/components/Starfield";
import Toast from "@/src/components/Toast";
import AddFriendButton from "@/src/components/AddFriendButton";

export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const { startCall } = useCall();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const p = await api.get(`/users/${id}`);
      setProfile(p);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={C.brandPurple} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const isFollowing = user?.following?.includes(profile.id);
  const isFriend = user?.friends?.includes(profile.id);

  const toggleFollow = async () => {
    if (isFollowing) await api.del(`/follow/${profile.id}`);
    else await api.post(`/follow/${profile.id}`);
    await refreshUser();
  };
  const addFriend = async () => {
    setRequestSent(true);
    setToast(`Friend request sent to ${profile.display_name} 🚀`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await api.post(`/friends/request/${profile.id}`);
    } catch {
      setRequestSent(false);
      setToast("Couldn't send request. Try again.");
    }
  };
  const message = async () => {
    const conv = await api.post("/conversations", { type: "dm", participant_ids: [profile.id] });
    router.push({ pathname: "/chat/[id]", params: { id: conv.id } });
  };
  const call = (type: "voice" | "video" = "voice") => {
    startCall({ id: profile.id, name: profile.display_name, avatar: profile.avatar }, type);
  };

  return (
    <View style={styles.container}>
      <Starfield count={70} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={[C.brand, C.brandPurple, C.surface]} style={[styles.banner, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} testID="profile-back">
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.avatarWrap}>
            <Avatar uri={profile.avatar} name={profile.display_name} size={104} ring />
          </View>
          <Text style={styles.name}>{profile.display_name}</Text>
          {isFriend && (
            <View style={styles.friendBadge}>
              <Ionicons name="star" size={12} color={C.warning} />
              <Text style={styles.friendText}>Friend</Text>
            </View>
          )}
          <Text style={styles.desc}>{profile.description || "No description yet."}</Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{profile.followers?.length || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{profile.following?.length || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{profile.friends?.length || 0}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
          </View>

          {profile.id !== user?.id && (
            <View style={styles.actions}>
              <Pressable style={[styles.btn, isFollowing && styles.btnOutline]} onPress={toggleFollow} testID="profile-follow-button">
                <Text style={styles.btnText}>{isFollowing ? "Following" : "Follow"}</Text>
              </Pressable>
              {isFriend ? (
                <>
                  <Pressable style={[styles.btn, styles.btnAlt]} onPress={message} testID="profile-message-button">
                    <Ionicons name="chatbubble" size={18} color="#fff" />
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnAlt]} onPress={() => call("voice")} testID="profile-call-button">
                    <Ionicons name="call" size={18} color="#fff" />
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnAlt]} onPress={() => call("video")} testID="profile-video-call-button">
                    <Ionicons name="videocam" size={20} color="#fff" />
                  </Pressable>
                </>
              ) : (
                <AddFriendButton
                  sent={requestSent}
                  onPress={addFriend}
                  testID="profile-add-friend-button"
                  full
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  banner: { height: 150, paddingHorizontal: S.md },
  body: { alignItems: "center", marginTop: -52, paddingHorizontal: S.lg },
  avatarWrap: { borderRadius: 60 },
  name: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: S.md },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    marginTop: 6,
  },
  friendText: { color: C.warning, fontSize: 12, fontWeight: "700" },
  desc: { color: C.onSurface2, fontSize: 15, textAlign: "center", marginTop: S.md, paddingHorizontal: S.md },
  stats: { flexDirection: "row", gap: S["2xl"], marginTop: S.xl },
  stat: { alignItems: "center" },
  statNum: { color: "#fff", fontSize: 20, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 13 },
  actions: { flexDirection: "row", gap: S.md, marginTop: S.xl },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
    paddingHorizontal: S.xl,
    paddingVertical: 12,
    borderRadius: R.pill,
  },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.borderStrong },
  btnAlt: { backgroundColor: C.surface3, paddingHorizontal: S.lg },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
