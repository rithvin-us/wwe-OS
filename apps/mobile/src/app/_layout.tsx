import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="index" />
        <Stack.Screen name="hr/index" />
        <Stack.Screen name="hr/checkin" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="hr/employees/index" />
        <Stack.Screen name="hr/employees/[id]" />
        <Stack.Screen name="hr/leave/index" />
        <Stack.Screen name="hr/leave/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="hr/expenses/index" />
        <Stack.Screen name="hr/expenses/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="purchase/bills/index" />
        <Stack.Screen name="purchase/bills/[id]" />
        <Stack.Screen name="purchase/index" />
        <Stack.Screen name="purchase/scan" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="purchase/vendors" />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
