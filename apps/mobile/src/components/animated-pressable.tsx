import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { DURATION, EASE_OUT_QUART } from "@/lib/motion";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

/**
 * The one pressable-with-feedback primitive — every button/card/row that
 * responds to touch scales down slightly on press-in and springs back on
 * release, real motion (Reanimated shared values), not a static Pressable.
 * Uses the same duration/easing tokens as everything else in `lib/motion.ts`.
 */
export function AnimatedPressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={(e) => {
        scale.value = withTiming(0.96, { duration: DURATION.fast, easing: EASE_OUT_QUART });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: DURATION.base, easing: EASE_OUT_QUART });
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    />
  );
}
