import { Tabs, Redirect } from "expo-router";
import { useWindowDimensions } from "react-native";
import NovaTabBar, { SIDEBAR_WIDTH } from "@/src/components/NovaTabBar";
import { useAuth } from "@/src/AuthContext";

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <NovaTabBar {...props} desktop={desktop} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingLeft: desktop ? SIDEBAR_WIDTH : 0 },
      }}
    >
      <Tabs.Screen name="story" options={{ title: "Story" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="calls" options={{ title: "Calls" }} />
      <Tabs.Screen name="locations" options={{ title: "Locations" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
