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
        <Stack.Screen name="invoices/index" />
        <Stack.Screen name="invoices/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="invoices/[id]/index" />
        <Stack.Screen name="invoices/[id]/edit" options={{ presentation: "modal" }} />
        <Stack.Screen name="customers" />
        <Stack.Screen name="dms/index" />
        <Stack.Screen name="dms/upload" options={{ presentation: "modal" }} />
        <Stack.Screen name="dms/[id]" />
        <Stack.Screen name="assets/index" />
        <Stack.Screen name="assets/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="reports" />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="timeline" />
        <Stack.Screen name="automation/index" />
        <Stack.Screen name="automation/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="automation/[id]/edit" options={{ presentation: "modal" }} />
        <Stack.Screen name="automation/runs/[id]" />
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
