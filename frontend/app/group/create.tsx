import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

export default function CreateGroup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [friends, setFriends] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/friends").then(setFriends).catch(() => {});
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const create = async () => {
    if (!name.trim() || selected.length === 0) return;
    setBusy(true);
    try {
      const conv = await api.post("/conversations", {
        type: "group",
        participant_ids: selected,
        name: name.trim(),
        description: desc,
        color: C.surface,
      });
      router.replace({ pathname: "/chat/[id]", params: { id: conv.id } });
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="close-create-group">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>New Group</Text>
        <Pressable onPress={create} disabled={busy} testID="submit-group-button">
          {busy ? <ActivityIndicator color={C.brandPurple} /> : <Text style={styles.create}>Create</Text>}
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Group name"
        placeholderTextColor={C.muted}
        testID="group-name-input"
      />
      <TextInput
        style={[styles.input, { height: 70, textAlignVertical: "top" }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="Description"
        placeholderTextColor={C.muted}
        multiline
        testID="group-desc-input"
      />

      <Text style={styles.section}>Add friends ({selected.length})</Text>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        ListEmptyComponent={<Text style={styles.hint}>Add friends first to create a group.</Text>}
        renderItem={({ item }) => {
          const sel = selected.includes(item.id);
          return (
            <Pressable style={styles.row} onPress={() => toggle(item.id)} testID={`select-friend-${item.id}`}>
              <Avatar uri={item.avatar} name={item.display_name} size={44} />
              <Text style={styles.name}>{item.display_name}</Text>
              <Ionicons
                name={sel ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={sel ? C.success : C.muted}
              />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, padding: S.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  create: { color: C.brandPurple, fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: C.surface2,
    borderRadius: R.md,
    padding: S.md,
    color: "#fff",
    fontSize: 16,
    marginBottom: S.md,
  },
  section: { color: "#fff", fontSize: 16, fontWeight: "700", marginVertical: S.sm },
  hint: { color: C.muted, marginTop: S.md },
  row: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.sm },
  name: { color: "#fff", fontSize: 16, flex: 1 },
});
