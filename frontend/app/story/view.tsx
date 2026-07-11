import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { C, S } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

const { width, height } = Dimensions.get("window");

export default function StoryViewer() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const timer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await api.get("/stories");
        const g = all.find((x: any) => x.user.id === uid);
        setGroup(g);
      } catch {}
      setLoading(false);
    })();
  }, [uid]);

  const stories = group?.stories || [];
  const current = stories[idx];

  useEffect(() => {
    if (!current || current.media_type !== "image") return;
    timer.current = setTimeout(() => next(), 5000);
    return () => clearTimeout(timer.current);
  }, [idx, current]);

  const next = () => {
    if (idx < stories.length - 1) setIdx(idx + 1);
    else router.back();
  };
  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#fff" }}>No story available.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.brandPurple }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="story-viewer">
      {current.media_type === "image" ? (
        <Image source={{ uri: current.media }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : (
        <VideoScreen uri={current.media} onEnd={next} />
      )}

      {/* Progress bars */}
      <View style={[styles.progress, { top: insets.top + 6 }]}>
        {stories.map((_: any, i: number) => (
          <View key={i} style={styles.progTrack}>
            <View style={[styles.progFill, { width: i < idx ? "100%" : i === idx ? "50%" : "0%" }]} />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={[styles.head, { top: insets.top + 18 }]}>
        <Avatar uri={group.user.avatar} name={group.user.display_name} size={36} />
        <Text style={styles.name}>{group.user.display_name}</Text>
        <Pressable onPress={() => router.back()} testID="close-story-viewer">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>

      {current.caption ? <Text style={[styles.caption, { bottom: insets.bottom + 40 }]}>{current.caption}</Text> : null}

      {/* Tap zones */}
      <Pressable style={styles.left} onPress={prev} />
      <Pressable style={styles.right} onPress={next} testID="story-next-zone" />
    </View>
  );
}

function VideoScreen({ uri, onEnd }: { uri: string; onEnd: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener("playToEnd", onEnd);
    return () => sub.remove();
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  progress: { position: "absolute", left: S.md, right: S.md, flexDirection: "row", gap: 4 },
  progTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  progFill: { height: 3, borderRadius: 2, backgroundColor: "#fff" },
  head: { position: "absolute", left: S.md, right: S.md, flexDirection: "row", alignItems: "center", gap: S.sm },
  name: { color: "#fff", fontWeight: "700", fontSize: 16, flex: 1 },
  caption: {
    position: "absolute",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: S.lg,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
  },
  left: { position: "absolute", left: 0, top: 80, bottom: 80, width: width * 0.35 },
  right: { position: "absolute", right: 0, top: 80, bottom: 80, width: width * 0.65 },
});
