import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { useCall } from "@/src/CallContext";
import { api } from "@/src/api";
import { C, S, R, textOn, mutedOn } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, subscribe } = useAuth();
  const call = useCall();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conv, setConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        api.get(`/conversations/${id}`),
        api.get(`/conversations/${id}/messages`),
      ]);
      setConv(c);
      setMessages(m);
      setLoadError(false);
    } catch {
      // Don't clear conv/messages on a failed refresh — a sleeping
      // Render backend can make one request fail without anything
      // actually being wrong with the conversation itself. Losing the
      // real name/avatar/messages here was what caused everything to
      // look "deleted" after a refresh.
      setLoadError(true);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribe((event, payload) => {
      if (event === "message" && payload.conversation_id === id) {
        setMessages((prev) => [...prev, payload]);
      }
    });
    return () => { unsub(); };
  }, [subscribe, id]);

  const [sendError, setSendError] = useState<string | null>(null);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSendError(null);
    try {
      const msg = await api.post(`/conversations/${id}/messages`, { text: t });
      setMessages((prev) => [...prev, msg]);
      setText("");
    } catch (e) {
      // Keep the typed text so nothing is lost, and tell the person it
      // failed instead of silently swallowing the error — a slow/sleeping
      // backend (Render free tier) can make the very first request of a
      // session fail or time out.
      setSendError("Message didn't send — check your connection and try again.");
    }
  };

  const bg = conv?.color && conv.color !== C.surface ? conv.color : (user?.chat_bg_color || C.surface);
  const fg = textOn(bg);
  const dim = mutedOn(bg);

  const startCall = (type: "voice" | "video" = "voice") => {
    if (conv?.type === "dm" && conv.other_id) {
      call.startCall(
        { id: conv.other_id, name: conv.display_name, avatar: conv.display_avatar },
        type
      );
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const prev = messages[index - 1];
    const mine = item.sender_id === user?.id;
    const clustered =
      prev &&
      prev.sender_id === item.sender_id &&
      new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

    const timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const prevLabel = prev
      ? new Date(prev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const showGutterTime = clustered && timeLabel !== prevLabel;

    return (
      <View style={[styles.msgRow, { marginTop: clustered ? 2 : S.md }]}>
        <View style={styles.gutter}>
          {!clustered ? (
            <Avatar uri={item.sender_avatar} name={item.sender_name} size={40} />
          ) : showGutterTime ? (
            <Text style={[styles.gutterTime, { color: dim }]}>{timeLabel}</Text>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          {!clustered && (
            <View style={styles.msgHead}>
              <Text style={[styles.sender, { color: mine ? C.brandPurple : C.brandBlue }]}>
                {item.sender_name}
              </Text>
              <Text style={[styles.time, { color: dim }]}>{timeLabel}</Text>
            </View>
          )}
          <Text style={[styles.msgText, { color: fg }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} testID="back-button">
          <Ionicons name="chevron-back" size={28} color={fg} />
        </Pressable>
        <Pressable
          style={styles.headInfo}
          onPress={() => conv?.type === "dm" && conv.other_id && router.push(`/profile/${conv.other_id}`)}
        >
          {conv?.type === "group" ? (
            <View style={styles.gicon}><Ionicons name="people" size={18} color="#fff" /></View>
          ) : (
            <Avatar uri={conv?.display_avatar} name={conv?.display_name} size={36} />
          )}
          <Text style={[styles.headName, { color: fg }]} numberOfLines={1}>
            {conv?.display_name || "Chat"}
          </Text>
        </Pressable>
        {conv?.type === "dm" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.md }}>
            <Pressable onPress={() => startCall("voice")} testID="chat-call-button">
              <Ionicons name="call" size={24} color={fg} />
            </Pressable>
            <Pressable onPress={() => startCall("video")} testID="chat-video-call-button">
              <Ionicons name="videocam" size={26} color={fg} />
            </Pressable>
          </View>
        )}
      </View>

      {loadError && (
        <Pressable style={styles.errorBanner} onPress={load} testID="chat-load-retry">
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.errorBannerText}>Couldn't load this chat — tap to retry</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: S.md, paddingBottom: S.md }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: dim }]}>No messages yet. Say something!</Text>
          }
        />
        {sendError && (
          <View style={styles.sendErrorBar}>
            <Ionicons name="warning" size={14} color="#fca5a5" />
            <Text style={styles.sendErrorText}>{sendError}</Text>
          </View>
        )}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom || S.sm }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={C.muted}
            testID="message-input"
            multiline
          />
          <Pressable style={styles.sendBtn} onPress={send} testID="send-message-button">
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    paddingVertical: 8,
    paddingHorizontal: S.md,
  },
  errorBannerText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  sendErrorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: S.md,
    paddingBottom: 4,
  },
  sendErrorText: { color: "#fca5a5", fontSize: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    paddingHorizontal: S.md,
    paddingBottom: S.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  headInfo: { flexDirection: "row", alignItems: "center", gap: S.sm, flex: 1 },
  headName: { fontSize: 18, fontWeight: "700", flex: 1 },
  gicon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  msgRow: { flexDirection: "row", gap: S.sm, paddingHorizontal: S.xs },
  gutter: { width: 44, alignItems: "flex-start", justifyContent: "center" },
  gutterTime: { fontSize: 8, marginLeft: 0 },
  msgHead: { flexDirection: "row", alignItems: "baseline", gap: S.sm },
  sender: { fontSize: 15, fontWeight: "500" },
  time: { fontSize: 10 },
  msgText: { fontSize: 15, lineHeight: 21, marginTop: 1 },
  empty: { textAlign: "center", marginTop: 60, fontSize: 14 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: S.sm,
    paddingHorizontal: S.md,
    paddingTop: S.sm,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    backgroundColor: "rgba(8,11,20,0.9)",
  },
  input: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: R.lg,
    paddingHorizontal: S.md,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: C.brand,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

