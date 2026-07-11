import React from "react";
import { StyleSheet, View } from "react-native";
import { RTCModule, webrtcAvailable } from "@/src/webrtc";

// Native renders WebRTC MediaStreams with react-native-webrtc's RTCView.
export default function CallVideoView({
  stream,
  mirrored,
  style,
}: {
  stream: any;
  mirrored?: boolean;
  style?: any;
}) {
  if (!stream || !webrtcAvailable || !RTCModule?.RTCView) return null;
  const { RTCView } = RTCModule;

  return (
    <View style={[styles.wrap, style]}>
      <RTCView
        streamURL={stream.toURL()}
        style={StyleSheet.absoluteFill}
        objectFit="cover"
        mirror={mirrored}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: "#000" },
});
