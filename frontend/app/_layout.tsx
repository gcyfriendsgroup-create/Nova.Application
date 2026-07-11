import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/AuthContext";
import { CallProvider } from "@/src/CallContext";
import CallOverlay from "@/src/components/CallOverlay";

LogBox.ignoreAllLogs(true);

// Foreground push behavior — module scope, before any component (web-guarded)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  }).catch(() => {});
}

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const router = useRouter();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const route = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (url.startsWith("http")) Linking.openURL(url);
      else router.push(url);
    };
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      route(response.notification.request.content.data || {});
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) route(response.notification.request.content.data || {});
    });
    return () => {
      tapSub.remove();
    };
  }, [router]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CallProvider>
            <StatusBar style="light" />
            <View style={{ flex: 1, backgroundColor: "#05070D" }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#05070D" } }}>
                <Stack.Screen name="story/view" options={{ presentation: "fullScreenModal" }} />
              </Stack>
              <CallOverlay />
            </View>
          </CallProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
