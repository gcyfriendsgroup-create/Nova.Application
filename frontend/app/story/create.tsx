import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";

export default function CreateStory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async (type: "image" | "video") => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "image" ? ["images"] : ["videos"],
      quality: 0.5,
      base64: type === "image",
      videoMaxDuration: 15,
    });
    if (!res.canceled) {
      const a = res.assets[0];
      setMediaType(type);
      if (type === "image" && a.base64) setMedia(`data:image/jpeg;base64,${a.base64}`);
      else setMedia(a.uri);
    }
  };

  const post = async () => {
    if (!media) return;
    setBusy(true);
    try {
      await api.post("/stories", { media, media_type: mediaType, caption });
      router.back();
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="close-create-story">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>New Story</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.preview}>
        {media ? (
          mediaType === "image" ? (
            <Image source={{ uri: media }} style={styles.previewImg} contentFit="cover" />
          ) : (
            <View style={[styles.previewImg, styles.videoBox]}>
              <Ionicons name="videocam" size={48} color="#fff" />
              <Text style={{ color: "#fff", marginTop: 8 }}>Video selected</Text>
            </View>
          )
        ) : (
          <View style={[styles.previewImg, styles.placeholder]}>
            <Ionicons name="images-outline" size={56} color={C.muted} />
            <Text style={{ color: C.muted, marginTop: 8 }}>Pick a photo or video</Text>
          </View>
        )}
      </View>

      <View style={styles.pickRow}>
        <Pressable style={styles.pickBtn} onPress={() => pick("image")} testID="pick-image-button">
          <Ionicons name="image" size={22} color="#fff" />
          <Text style={styles.pickText}>Photo</Text>
        </Pressable>
        <Pressable style={styles.pickBtn} onPress={() => pick("video")} testID="pick-video-button">
          <Ionicons name="videocam" size={22} color="#fff" />
          <Text style={styles.pickText}>Video</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.caption}
        value={caption}
        onChangeText={setCaption}
        placeholder="Add a caption…"
        placeholderTextColor={C.muted}
        testID="story-caption-input"
      />

      <Pressable
        style={[styles.postBtn, !media && { opacity: 0.5 }]}
        onPress={post}
        disabled={!media || busy}
        testID="post-story-button"
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.postText}>Post to Story</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, padding: S.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  preview: { alignItems: "center", marginBottom: S.lg },
  previewImg: { width: "100%", height: 360, borderRadius: R.lg },
  videoBox: { backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" },
  placeholder: { backgroundColor: C.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  pickRow: { flexDirection: "row", gap: S.md, marginBottom: S.lg },
  pickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.surface2,
    paddingVertical: 14,
    borderRadius: R.md,
  },
  pickText: { color: "#fff", fontWeight: "700" },
  caption: {
    backgroundColor: C.surface2,
    borderRadius: R.md,
    padding: S.md,
    color: "#fff",
    fontSize: 16,
    marginBottom: S.lg,
  },
  postBtn: { backgroundColor: C.brand, paddingVertical: 16, borderRadius: R.md, alignItems: "center" },
  postText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
