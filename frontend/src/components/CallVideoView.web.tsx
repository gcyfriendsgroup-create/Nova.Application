import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

// Web renders WebRTC MediaStreams with a plain <video> element — there's no
// RTCView on web, but the browser already knows how to play a MediaStream.
export default function CallVideoView({
  stream,
  mirrored,
  style,
}: {
  stream: any;
  mirrored?: boolean;
  style?: any;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);

  if (!stream) return null;

  return (
    <View style={[styles.wrap, style]}>
      {/* @ts-ignore — plain DOM element, valid under react-native-web */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={mirrored}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: "#000" },
});
