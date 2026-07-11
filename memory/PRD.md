# Nova — Product Requirements Document

## Original Problem Statement
A WhatsApp/Discord-style social app "Nova": live chat, calls (phone rings, Discord-style ringtone + animation), stories (photo/video for friends), groups with admins, follow system + separate Friends tier, live friends location map, profile & page color customization (auto white/dark text), custom display name, changeable profile picture, ringtone customization (default Discord), permissions (notifications/camera/mic), 5 bottom tabs: Story, Chat, Calls, Locations, Settings (gear). Brand: white Saturn with blue+purple orbiting dots on a navy starfield.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt) + Emergent Google Auth, WebSocket `/api/ws/{token}` for realtime messages, call signaling, and WebRTC signaling relay. httpx for Emergent Google + Push. Media stored base64.
- Frontend: Expo SDK 54, expo-router. react-native-reanimated, react-native-svg (logo), gesture-handler (PiP drag), expo-image-picker, expo-location, expo-camera, expo-notifications, react-native-webrtc (+@config-plugins).
- Theme: navy #05070D + blue/purple accents; luminance-based auto-contrast.

## Implemented
- Auth: email/password JWT + "Continue with Google" (Emergent-managed). login guards Google users (password None).
- Profile: name, description, avatar (base64), page color, chat bg color, ringtone.
- Follow + Friends tiers (request/accept) with notifications.
- Stories: photo/video, 24h, tray + full-screen viewer.
- Chat: DM + groups, Discord-style clustering; sender name lighter weight; gutter timestamp only on minute change (small). Realtime via WS. Per-chat color.
- Groups: create, description, admins.
- Calls (global CallContext + CallOverlay): outgoing/incoming Discord-style ring UI, name + "ringing…"/live timer, center avatar, controls (Video upgrade, Speaker, Mute, Share/screen, Add people multi-select), WhatsApp-style hangup, minimize → draggable PiP (snaps to corners) so you can chat during a call. WebRTC audio/video wired + signaling over WS (guarded: real on device build, simulated in Expo Go/web).
- Locations: permission-gated live map with friend markers.
- Settings gear tab: profile edit, color customization w/ auto-contrast preview, ringtone picker (Discord default), camera/mic/location permission toggles.
- Notifications: in-app list; push registration + non-blocking send on message/follow/friend-request/call (Emergent push).
- Responsive: left sidebar nav on desktop web (≥900px), bottom tab bar on phones. Nova Saturn SVG logo + starfield branding.

## Testing
- Backend: 41/41 pytest pass (incl. Google endpoint, register-push graceful, push hooks non-blocking, full regression). Frontend flows verified via screenshots (login, tabs desktop+mobile, call overlay, friend-request animation).

## Backlog / Remaining
- P0 (device build): provide Firebase `google-services.json` for push; generate dev/store build to activate real push + WebRTC audio/video.
- P1: real speaker routing (InCallManager), screen-share transport, group-call SFU/mesh audio, typing indicators, read receipts.
- P2: app icon PNG matching Saturn logo, group avatars, block/report, desktop layout for open-chat/profile screens, custom uploaded ringtones.

## Next Tasks
1. User uploads google-services.json → build → verify push + WebRTC on device.
2. Typing indicators & read receipts.
3. Polish desktop layout for detail (chat/profile) screens.
