import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import { router } from "expo-router";

import { KpiTile } from "@/components/kpi-tile";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { buildKpis, type Kpi } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";
import { listItemEntrance } from "@/lib/motion";

/**
 * Executive Overview — mobile counterpart to apps/web's "/". Same four KPIs,
 * same data sources. Everything past this (alerts, quick actions, activity)
 * is the next slice, not stubbed here.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const next = await buildKpis();
    setKpis(next);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.header}>
            <View>
              <ThemedText type="title" style={styles.title}>
                Welcome back
              </ThemedText>
              <ThemedText themeColor="mutedForeground">{user?.email}</ThemedText>
            </View>
            <AnimatedPressable
              onPress={signOut}
              style={[styles.signOut, { borderColor: theme.border }]}
            >
              <ThemedText type="small">Sign out</ThemedText>
            </AnimatedPressable>
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
            EXECUTIVE OVERVIEW
          </ThemedText>

          {kpis === null ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (
            <View style={styles.kpiGrid}>
              {kpis.map((kpi, index) => (
                <Animated.View key={kpi.key} entering={listItemEntrance(index)}>
                  <KpiTile kpi={kpi} />
                </Animated.View>
              ))}
            </View>
          )}

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
            QUICK ACTIONS
          </ThemedText>
          <View style={styles.kpiGrid}>
            <AnimatedPressable
              onPress={() => router.push("/hr/checkin")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Photo check-in</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Face match attendance
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/hr")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">HR</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Employees, leave, expenses
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/purchase/scan")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Scan a bill</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Camera OCR digitization
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/purchase")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Purchases</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Bills & vendors
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/invoices")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Invoices</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Generate & track billing
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/dms")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Documents</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Contracts & incoming files
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/assets")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Delivery Challans</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Generate & track DCs
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/reports")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Reports</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Ready-made reports, on demand
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/assistant")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Assistant</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Ask a question
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/timeline")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Timeline</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Everything that happened
              </ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/automation")}
              style={[
                styles.quickAction,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <ThemedText type="smallBold">Automation</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                Collect tagged records
              </ThemedText>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  signOut: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    letterSpacing: 0.6,
    marginTop: Spacing.two,
  },
  loader: {
    marginTop: Spacing.four,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  quickAction: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
});
