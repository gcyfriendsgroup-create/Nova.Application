import React, { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// White Saturn with two orbiting dots (blue + purple)
export default function NovaLogo({ size = 96, spin = true }: { size?: number; spin?: boolean }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (spin) {
      rot.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
    }
  }, [spin]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const s = size;
  const c = s / 2;
  const planetR = s * 0.24;
  const orbitR = s * 0.42;

  return (
    <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      {/* Orbiting dots layer */}
      <Animated.View
        style={[
          { position: "absolute", width: s, height: s },
          orbitStyle,
        ]}
      >
        <Svg width={s} height={s}>
          <Circle cx={c + orbitR} cy={c} r={s * 0.05} fill="#3B82F6" />
          <Circle cx={c - orbitR} cy={c} r={s * 0.05} fill="#8B5CF6" />
        </Svg>
      </Animated.View>

      {/* Saturn */}
      <Svg width={s} height={s}>
        <Defs>
          <RadialGradient id="planet" cx="40%" cy="35%" r="70%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#C7D2E5" />
          </RadialGradient>
        </Defs>
        <G>
          <Ellipse
            cx={c}
            cy={c}
            rx={s * 0.4}
            ry={s * 0.14}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={s * 0.035}
            opacity={0.9}
            transform={`rotate(-20 ${c} ${c})`}
          />
          <Circle cx={c} cy={c} r={planetR} fill="url(#planet)" />
          <Ellipse
            cx={c}
            cy={c}
            rx={s * 0.4}
            ry={s * 0.14}
            fill="none"
            stroke="#93C5FD"
            strokeWidth={s * 0.015}
            opacity={0.6}
            transform={`rotate(-20 ${c} ${c})`}
          />
        </G>
      </Svg>
    </View>
  );
}
