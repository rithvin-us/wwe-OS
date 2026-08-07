import { ApiRequestError } from "@bop/sdk";
import type { WorkforceSummary } from "@bop/shared-types";
import { currentPeriod } from "@bop/shared-types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getWorkforceSummary } from "@/lib/hr";

const NAV_ITEMS = [
  { href: "/hr/checkin", label: "Photo check-in", hint: "Face match attendance" },
  { href: "/hr/employees", label: "Employees", hint: "Directory & enrollment" },
  { href: "/hr/leave", label: "Leave", hint: "Requests & approvals" },
  { href: "/hr/expenses", label: "Expenses", hint: "Claims & approvals" },
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

export default function HrOverviewScreen() {
  const theme = useTheme();
  const [summary, setSummary] = useState<WorkforceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { year, month } = currentPeriod();
    getWorkforceSummary(year, month)
      .then(setSummary)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load workforce summary."),
      );
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            HR
          </ThemedText>

          {error ? (
            <ThemedText themeColor="destructive">{error}</ThemedText>
          ) : summary === null ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (
            <View style={styles.statGrid}>
              <StatTile label="On the rolls" value={String(summary.active_employees)} />
              <StatTile label="Attendance" value={`${summary.attendance_pct}%`} />
              <StatTile label="OT hours" value={String(summary.total_ot_hours)} />
              <StatTile label="Anomalies" value={String(summary.anomaly_count)} />
            </View>
          )}

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
            MODULES
          </ThemedText>
          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <Pressable
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
              </Pressable>
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
