import { Platform } from "react-native";

// Guarded loader: react-native-webrtc is a native module that is NOT available
// in Expo Go or on web. Requiring it there throws, so we swallow it and fall
// back to the simulated call experience. On a dev/store build it loads for real.
let RTC: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RTC = require("react-native-webrtc");
  } catch {
    RTC = null;
  }
}

export const webrtcAvailable = !!RTC && !!RTC.RTCPeerConnection;
export const RTCModule = RTC;
export const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
