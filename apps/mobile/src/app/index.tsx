import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KpiTile } from "@/components/kpi-tile";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { buildKpis, type Kpi } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";

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
    <ThemedView style={styles.container}>
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
            <Pressable onPress={signOut} style={[styles.signOut, { borderColor: theme.border }]}>
              <ThemedText type="small">Sign out</ThemedText>
            </Pressable>
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
            EXECUTIVE OVERVIEW
          </ThemedText>

          {kpis === null ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (
            <View style={styles.kpiGrid}>
              {kpis.map((kpi) => (
                <KpiTile key={kpi.key} kpi={kpi} />
              ))}
            </View>
          )}
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
});
