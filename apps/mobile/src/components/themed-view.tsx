import { View, type ViewProps } from "react-native";
import Animated from "react-native-reanimated";

import { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { screenEntrance } from "@/lib/motion";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  /** Fades in on mount using the same duration/easing tokens as web's `animate-in`. */
  animated?: boolean;
};

export function ThemedView({ style, type, animated, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const backgroundStyle = [{ backgroundColor: theme[type ?? "background"] }, style];

  if (animated) {
    return <Animated.View entering={screenEntrance()} style={backgroundStyle} {...otherProps} />;
  }
  return <View style={backgroundStyle} {...otherProps} />;
}
