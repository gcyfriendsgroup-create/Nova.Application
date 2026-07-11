// Web implementation — browsers ship WebRTC natively (RTCPeerConnection,
// RTCSessionDescription, RTCIceCandidate, navigator.mediaDevices), so no
// npm package is needed here at all. This mirrors the shape of webrtc.ts
// (the native module wrapper) so CallContext.tsx works unchanged on both.

const hasNativeRTC =
  typeof window !== "undefined" &&
  typeof (window as any).RTCPeerConnection !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

export const webrtcAvailable = hasNativeRTC;

export const RTCModule = hasNativeRTC
  ? {
      RTCPeerConnection: (window as any).RTCPeerConnection,
      RTCSessionDescription: (window as any).RTCSessionDescription,
      RTCIceCandidate: (window as any).RTCIceCandidate,
      mediaDevices: navigator.mediaDevices,
    }
  : null;

export const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
