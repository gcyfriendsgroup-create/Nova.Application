import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { requestCameraPermissionsAsync, requestMicrophonePermissionsAsync } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";
import { C, S, R, RINGTONES, textOn, mutedOn, isDarkColor } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

const SWATCHES = [
  "#05070D", "#111827", "#4F46E5", "#8B5CF6", "#3B82F6", "#0EA5E9",
  "#059669", "#DC2626", "#EA580C", "#DB2777", "#FDE047", "#FFFFFF",
  "#F3F4F6", "#FBCFE8", "#A7F3D0", "#1E1B4B",
];

export default function SettingsTab() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.display_name || "");
  const [desc, setDesc] = useState(user?.description || "");
  const [pageColor, setPageColor] = useState(user?.page_color || C.surface);
  const [chatBg, setChatBg] = useState(user?.chat_bg_color || C.surface);
  const [ringtone, setRingtone] = useState(user?.ringtone || "discord");
  const [saving, setSaving] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [locOn, setLocOn] = useState(false);

  const save = async (patch: any) => {
    setSaving(true);
    try {
      const updated = await api.put("/users/me", patch);
      setUser(updated);
    } catch {}
    setSaving(false);
  };

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!res.canceled && res.assets[0].base64) {
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      save({ avatar: uri });
    }
  };

  const toggleCam = async (v: boolean) => {
    if (v) {
      const { status } = await requestCameraPermissionsAsync();
      setCamOn(status === "granted");
    } else setCamOn(false);
  };
  const toggleMic = async (v: boolean) => {
    if (v) {
      const { status } = await requestMicrophonePermissionsAsync();
      setMicOn(status === "granted");
    } else setMicOn(false);
  };
  const toggleLoc = async (v: boolean) => {
    if (v) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocOn(status === "granted");
    } else setLocOn(false);
  };

  const previewFg = textOn(pageColor);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + 12, paddingBottom: 120 }}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <View style={styles.profileHead}>
          <Pressable onPress={pickAvatar} testID="change-avatar-button">
            <Avatar uri={user?.avatar} name={name} size={90} ring />
            <View style={styles.camBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
        </View>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          onBlur={() => save({ display_name: name })}
          placeholder="Your name"
          placeholderTextColor={C.muted}
          testID="display-name-input"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          value={desc}
          onChangeText={setDesc}
          onBlur={() => save({ description: desc })}
          placeholder="Tell people about yourself"
          placeholderTextColor={C.muted}
          multiline
          testID="description-input"
        />

        {/* Page color */}
        <Text style={styles.section}>Page color</Text>
        <View style={[styles.preview, { backgroundColor: pageColor }]}>
          <Text style={{ color: previewFg, fontWeight: "700", fontSize: 16 }}>Aa Preview</Text>
          <Text style={{ color: mutedOn(pageColor), fontSize: 13 }}>
            Text auto-adapts · {isDarkColor(pageColor) ? "dark bg → white text" : "light bg → dark text"}
          </Text>
        </View>
        <View style={styles.swatches}>
          {SWATCHES.map((s) => (
            <Pressable
              key={s}
              style={[styles.swatch, { backgroundColor: s }, pageColor === s && styles.swatchSel]}
              onPress={() => { setPageColor(s); save({ page_color: s }); }}
              testID={`page-color-${s}`}
            />
          ))}
        </View>

        {/* Chat bg color */}
        <Text style={styles.section}>Chat background</Text>
        <View style={styles.swatches}>
          {SWATCHES.map((s) => (
            <Pressable
              key={"c" + s}
              style={[styles.swatch, { backgroundColor: s }, chatBg === s && styles.swatchSel]}
              onPress={() => { setChatBg(s); save({ chat_bg_color: s }); }}
              testID={`chat-color-${s}`}
            />
          ))}
        </View>

        {/* Ringtone */}
        <Text style={styles.section}>Ringtone</Text>
        {RINGTONES.map((rt) => (
          <Pressable
            key={rt}
            style={styles.rtRow}
            onPress={() => { setRingtone(rt); save({ ringtone: rt }); }}
            testID={`ringtone-${rt}`}
          >
            <Ionicons
              name={ringtone === rt ? "radio-button-on" : "radio-button-off"}
              size={22}
              color={ringtone === rt ? C.brandPurple : C.muted}
            />
            <Text style={styles.rtText}>{rt.charAt(0).toUpperCase() + rt.slice(1)}</Text>
            {rt === "discord" && <Text style={styles.default}>default</Text>}
          </Pressable>
        ))}

        {/* Permissions */}
        <Text style={styles.section}>Permissions</Text>
        <View style={styles.permRow}>
          <Ionicons name="camera-outline" size={22} color="#fff" />
          <Text style={styles.permText}>Camera</Text>
          <Switch value={camOn} onValueChange={toggleCam} testID="camera-toggle" />
        </View>
        <View style={styles.permRow}>
          <Ionicons name="mic-outline" size={22} color="#fff" />
          <Text style={styles.permText}>Microphone</Text>
          <Switch value={micOn} onValueChange={toggleMic} testID="mic-toggle" />
        </View>
        <View style={styles.permRow}>
          <Ionicons name="location-outline" size={22} color="#fff" />
          <Text style={styles.permText}>Location</Text>
          <Switch value={locOn} onValueChange={toggleLoc} testID="location-toggle" />
        </View>

        <Pressable style={styles.link} onPress={() => router.push("/people")} testID="manage-people-button">
          <Ionicons name="people-outline" size={22} color="#fff" />
          <Text style={styles.permText}>Friends & Followers</Text>
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Pressable>

        <Pressable style={styles.logout} onPress={logout} testID="logout-button">
          <Ionicons name="log-out-outline" size={20} color={C.error} />
          <Text style={{ color: C.error, fontWeight: "700", fontSize: 16 }}>Log out</Text>
        </Pressable>

        {saving && <ActivityIndicator color={C.brandPurple} style={{ marginTop: S.md }} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: S.lg },
  profileHead: { alignItems: "center", marginBottom: S.lg },
  camBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: C.brand,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.surface,
  },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, marginTop: S.sm },
  input: {
    backgroundColor: C.surface2,
    borderRadius: R.md,
    padding: S.md,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  section: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: S.xl, marginBottom: S.sm },
  preview: {
    borderRadius: R.lg,
    padding: S.lg,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: S.md },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.borderStrong },
  swatchSel: { borderWidth: 3, borderColor: C.brandPurple },
  rtRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.sm },
  rtText: { color: "#fff", fontSize: 16 },
  default: { color: C.brandPurple, fontSize: 12, marginLeft: 6 },
  permRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  permText: { color: "#fff", fontSize: 16, flex: 1 },
  link: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md, marginTop: S.sm },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: S.xl,
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.error,
  },
});
