import { ApiRequestError } from "@bop/sdk";
import type { PurchaseBillStats } from "@bop/shared-types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getPurchaseBillStats } from "@/lib/purchase";

const NAV_ITEMS = [
  { href: "/purchase/scan", label: "Scan a bill", hint: "Camera OCR digitization" },
  { href: "/purchase/bills", label: "Bills", hint: "Digitized purchase records" },
  { href: "/purchase/vendors", label: "Vendors", hint: "Directory & GSTIN" },
] as const;

function StatTile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <ThemedText type="small" themeColor="mutedForeground" style={styles.statLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText type="title" style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function PurchaseOverviewScreen() {
  const theme = useTheme();
  const [stats, setStats] = useState<PurchaseBillStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPurchaseBillStats()
      .then(setStats)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load purchase stats."),
      );
  }, []);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Purchases
          </ThemedText>

          {error ? (
            <ThemedText themeColor="destructive">{error}</ThemedText>
          ) : stats === null ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (
            <View style={styles.statGrid}>
              <StatTile label="Processed" value={String(stats.processed)} />
              <StatTile label="Needs attention" value={String(stats.needs_attention)} />
              <StatTile label="Unpaid" value={String(stats.unpaid)} />
              <StatTile label="Total bills" value={String(stats.total)} />
            </View>
          )}

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
            MODULES
          </ThemedText>
          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <AnimatedPressable
                key={item.href}
                onPress={() => router.push(item.href)}
                style={[styles.navRow, { borderColor: theme.border, backgroundColor: theme.card }]}
              >
                <View>
                  <ThemedText type="smallBold">{item.label}</ThemedText>
                  <ThemedText type="small" themeColor="mutedForeground">
                    {item.hint}
                  </ThemedText>
                </View>
                <ThemedText themeColor="mutedForeground">›</ThemedText>
              </AnimatedPressable>
            ))}
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
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  loader: {
    marginTop: Spacing.four,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  statTile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionLabel: {
    marginTop: Spacing.two,
  },
  navList: {
    gap: Spacing.two,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
  },
});
