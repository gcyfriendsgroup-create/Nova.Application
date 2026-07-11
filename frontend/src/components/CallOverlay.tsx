import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useCall, Peer } from "@/src/CallContext";
import { api } from "@/src/api";
import { C, S, R } from "@/src/theme";
import Avatar from "./Avatar";
import Starfield from "./Starfield";
import CallVideoView from "./CallVideoView";

function Ring({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false)
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + p.value * 1.6 }],
    opacity: 0.5 * (1 - p.value),
  }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

function CtrlButton({
  icon,
  label,
  active,
  onPress,
  lib = "ion",
  testID,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onPress: () => void;
  lib?: "ion" | "mat";
  testID?: string;
}) {
  return (
    <Pressable style={styles.ctrlWrap} onPress={onPress} testID={testID}>
      <View style={[styles.ctrl, active && styles.ctrlActive]}>
        {lib === "ion" ? (
          <Ionicons name={icon} size={24} color={active ? C.surface : "#fff"} />
        ) : (
          <MaterialIcons name={icon} size={24} color={active ? C.surface : "#fff"} />
        )}
      </View>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

export default function CallOverlay() {
  const call = useCall();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [showAdd, setShowAdd] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  // PiP position
  const PIP_W = 116;
  const PIP_H = 158;
  const margin = 12;
  const corners = {
    tl: { x: margin, y: insets.top + margin },
    tr: { x: width - PIP_W - margin, y: insets.top + margin },
    bl: { x: margin, y: height - PIP_H - margin - 80 },
    br: { x: width - PIP_W - margin, y: height - PIP_H - margin - 80 },
  };
  const tx = useSharedValue(corners.br.x);
  const ty = useSharedValue(corners.br.y);

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
    })
    .onEnd(() => {
      const left = tx.value + PIP_W / 2 < width / 2;
      const top = ty.value + PIP_H / 2 < height / 2;
      const target = left ? (top ? corners.tl : corners.bl) : top ? corners.tr : corners.br;
      tx.value = withSpring(target.x, { damping: 18 });
      ty.value = withSpring(target.y, { damping: 18 });
    });

  const pipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const openAdd = async () => {
    try {
      const f = await api.get("/friends");
      setFriends(f);
    } catch {}
    setSelected([]);
    setShowAdd(true);
  };

  const confirmAdd = () => {
    const chosen: Peer[] = friends
      .filter((f) => selected.includes(f.id))
      .map((f) => ({ id: f.id, name: f.display_name, avatar: f.avatar }));
    if (chosen.length) call.addParticipants(chosen);
    setShowAdd(false);
  };

  if (!call || call.status === "idle") return null;

  const mm = String(Math.floor(call.seconds / 60)).padStart(2, "0");
  const ss = String(call.seconds % 60).padStart(2, "0");
  const statusText =
    call.status === "active" ? `${mm}:${ss}` : call.status === "incoming" ? "incoming…" : "ringing…";

  // ---- Minimized PiP ----
  if (call.minimized && call.status !== "incoming") {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.pip, { width: PIP_W, height: PIP_H }, pipStyle]} testID="call-pip">
            <Starfield count={16} />
            <Pressable style={styles.pipInner} onPress={() => call.setMinimized(false)} testID="expand-call-button">
              <Avatar uri={call.peer?.avatar} name={call.peer?.name} size={44} ring />
              <Text style={styles.pipName} numberOfLines={1}>{call.peer?.name}</Text>
              <Text style={styles.pipTime}>{statusText}</Text>
              <Pressable style={styles.pipHang} onPress={call.endCall} testID="pip-hangup-button">
                <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }

  const ringing = call.status !== "active";
  const others = [call.peer, ...call.participants].filter(Boolean);

  return (
    <View style={styles.overlay} testID="call-overlay">
      <Starfield count={80} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {call.status !== "incoming" && (
          <Pressable onPress={() => call.setMinimized(true)} style={styles.minBtn} testID="minimize-call-button">
            <Ionicons name="contract-outline" size={26} color="#fff" />
          </Pressable>
        )}
        <View style={styles.topCenter}>
          <Text style={styles.topName}>
            {call.peer?.name}
            {call.participants.length > 0 ? ` +${call.participants.length}` : ""}
          </Text>
          <Text style={styles.topStatus}>{statusText}</Text>
        </View>
      </View>

      {/* Center avatar + rings, or live video once connected */}
      <View style={styles.center}>
        {call.status === "active" && call.callType === "video" && call.remoteStream ? (
          <CallVideoView stream={call.remoteStream} style={StyleSheet.absoluteFill} />
        ) : (
          <>
            {ringing && (
              <>
                <Ring delay={0} color={C.brandBlue} />
                <Ring delay={700} color={C.brandPurple} />
                <Ring delay={1400} color={C.brandBlue} />
              </>
            )}
            {others.length <= 1 ? (
              <Avatar uri={call.peer?.avatar} name={call.peer?.name} size={140} />
            ) : (
              <View style={styles.groupGrid}>
                {others.map((o: any) => (
                  <View key={o.id} style={{ alignItems: "center" }}>
                    <Avatar uri={o.avatar} name={o.name} size={72} />
                    <Text style={styles.gridName} numberOfLines={1}>{o.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {call.status === "active" && call.callType === "video" && call.localStream && (
          <CallVideoView stream={call.localStream} mirrored style={styles.pip} />
        )}
        {call.callType === "video" && call.videoOn && (
          <View style={styles.videoTag}>
            <Ionicons name="videocam" size={14} color="#fff" />
            <Text style={styles.videoTagText}>Video</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      {call.status === "incoming" ? (
        <View style={styles.answerRow}>
          <Pressable style={[styles.answerBtn, { backgroundColor: C.error }]} onPress={call.declineCall} testID="decline-call-button">
            <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
          <Pressable style={[styles.answerBtn, { backgroundColor: C.success }]} onPress={call.acceptCall} testID="accept-call-button">
            <Ionicons name="call" size={30} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.controlsWrap}>
          <View style={styles.controlsRow}>
            {call.callType === "voice" && (
              <CtrlButton icon="videocam" label="Video" active={call.videoOn} onPress={call.upgradeToVideo} testID="call-upgrade-video-button" />
            )}
            <CtrlButton icon={call.speaker ? "volume-high" : "volume-medium"} label="Speaker" active={call.speaker} onPress={() => call.setSpeaker(!call.speaker)} testID="call-speaker-button" />
            <CtrlButton icon={call.muted ? "mic-off" : "mic"} label={call.muted ? "Unmute" : "Mute"} active={call.muted} onPress={() => call.setMuted(!call.muted)} testID="call-mute-button" />
            <CtrlButton lib="mat" icon="screen-share" label="Share" active={call.sharing} onPress={() => call.setSharing(!call.sharing)} testID="call-share-button" />
            <CtrlButton icon="person-add" label="Add" onPress={openAdd} testID="call-add-people-button" />
          </View>
          <Pressable style={styles.hangup} onPress={call.endCall} testID="hangup-button">
            <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
        </View>
      )}

      {/* Add people modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + S.lg }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Add to call</Text>
              <Pressable onPress={() => setShowAdd(false)} testID="close-add-people">
                <Ionicons name="close" size={26} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {friends.length === 0 ? (
                <Text style={styles.emptyF}>No friends to add yet.</Text>
              ) : (
                friends.map((f) => {
                  const sel = selected.includes(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      style={styles.fRow}
                      onPress={() => setSelected((s) => (sel ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                      testID={`add-call-friend-${f.id}`}
                    >
                      <Avatar uri={f.avatar} name={f.display_name} size={44} />
                      <Text style={styles.fName}>{f.display_name}</Text>
                      <Ionicons name={sel ? "checkmark-circle" : "ellipse-outline"} size={24} color={sel ? C.success : C.muted} />
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={[styles.addConfirm, !selected.length && { opacity: 0.5 }]} onPress={confirmAdd} disabled={!selected.length} testID="confirm-add-people">
              <Text style={styles.addConfirmText}>Add {selected.length ? `(${selected.length})` : ""}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.surface, zIndex: 1000 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: S.md, minHeight: 70 },
  minBtn: { position: "absolute", left: S.md, top: undefined, zIndex: 2, padding: 6 },
  topCenter: { flex: 1, alignItems: "center" },
  topName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  topStatus: { color: C.brandPurple, fontSize: 15, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2 },
  groupGrid: { flexDirection: "row", flexWrap: "wrap", gap: S.lg, justifyContent: "center", maxWidth: 300 },
  gridName: { color: "#fff", fontSize: 12, marginTop: 4, maxWidth: 72, textAlign: "center" },
  pip: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 96,
    height: 130,
    borderRadius: R.md,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  videoTag: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: S.lg,
    backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill,
  },
  videoTagText: { color: "#fff", fontSize: 12 },
  controlsWrap: { alignItems: "center", paddingBottom: 50 },
  controlsRow: { flexDirection: "row", justifyContent: "center", gap: S.md, marginBottom: S.xl, flexWrap: "wrap", paddingHorizontal: S.md },
  ctrlWrap: { alignItems: "center", width: 62 },
  ctrl: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  ctrlActive: { backgroundColor: "#fff" },
  ctrlLabel: { color: C.onSurface2, fontSize: 11, marginTop: 6 },
  hangup: {
    backgroundColor: C.error, width: 150, height: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center",
  },
  answerRow: { flexDirection: "row", justifyContent: "center", gap: 80, paddingBottom: 70 },
  answerBtn: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  // PiP
  pip: {
    position: "absolute", borderRadius: R.lg, backgroundColor: C.surface2, overflow: "hidden",
    borderWidth: 1, borderColor: C.borderStrong,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  pipInner: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.sm },
  pipName: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 6 },
  pipTime: { color: C.brandPurple, fontSize: 11, marginTop: 2 },
  pipHang: {
    marginTop: S.sm, backgroundColor: C.error, width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  // modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface2, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: S.md },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  emptyF: { color: C.muted, textAlign: "center", padding: S.xl },
  fRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.sm },
  fName: { color: "#fff", fontSize: 16, flex: 1 },
  addConfirm: { backgroundColor: C.brand, borderRadius: R.md, paddingVertical: 14, alignItems: "center", marginTop: S.md },
  addConfirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
