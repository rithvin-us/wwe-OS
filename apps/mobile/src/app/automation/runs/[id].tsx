import { ApiRequestError } from "@bop/sdk";
import type { AutomationRun } from "@bop/shared-types";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getRun, openRunOutput } from "@/lib/automation";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

export default function AutomationRunDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [run, setRun] = useState<AutomationRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setRun(await getRun(id));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this run."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpen() {
    if (!run) return;
    setOpening(true);
    try {
      await openRunOutput(run);
    } catch (err) {
      setError(errorMessage(err, "Couldn't open the file."));
    } finally {
      setOpening(false);
    }
  }

  if (error && !run) {
    return (
      <ThemedView style={styles.container} animated>
        <SafeAreaView style={styles.center}>
          <ThemedText themeColor="destructive">{error}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!run) {
    return (
      <ThemedView style={styles.container} animated>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const hasOutput = !!(run.download_url || run.report_export_id || run.filename);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>
              {run.rule_name}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={run.status === "success" ? "success" : "destructive"}
            >
              {run.status === "success" ? "Success" : "Failed"}
            </ThemedText>
          </View>
          <ThemedText themeColor="mutedForeground">
            {run.destination.replace("_", " ")} ·{" "}
            {run.triggered_by === "manual" ? "Manual" : "Scheduled"}
          </ThemedText>

          <View style={styles.statGrid}>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                Started
              </ThemedText>
              <ThemedText type="smallBold">
                {run.started_at?.slice(0, 16).replace("T", " ") || "—"}
              </ThemedText>
            </View>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                Finished
              </ThemedText>
              <ThemedText type="smallBold">
                {run.finished_at?.slice(0, 16).replace("T", " ") || "—"}
              </ThemedText>
            </View>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                Items
              </ThemedText>
              <ThemedText type="smallBold">{run.item_count}</ThemedText>
            </View>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                File
              </ThemedText>
              <ThemedText type="smallBold">{run.filename || "None"}</ThemedText>
            </View>
          </View>

          {run.status === "failed" && run.error_message ? (
            <View
              style={[
                styles.errorBanner,
                { borderColor: theme.destructive, backgroundColor: `${theme.destructive}18` },
              ]}
            >
              <ThemedText type="small" themeColor="destructive">
                {run.error_message}
              </ThemedText>
            </View>
          ) : null}

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          {hasOutput ? (
            <AnimatedPressable
              onPress={handleOpen}
              disabled={opening}
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            >
              {opening ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                  Download
                </ThemedText>
              )}
            </AnimatedPressable>
          ) : null}

          {run.items.length > 0 ? (
            <>
              <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
                ITEMS
              </ThemedText>
              <View style={styles.list}>
                {run.items.map((item, index) => (
                  <View
                    key={index}
                    style={[
                      styles.itemRow,
                      { borderColor: theme.border, backgroundColor: theme.card },
                    ]}
                  >
                    <View style={styles.itemMain}>
                      <ThemedText type="small">{item.title}</ThemedText>
                      <ThemedText type="small" themeColor="mutedForeground">
                        {item.module ?? item.object_type ?? ""}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor={item.included ? "success" : "warning"}>
                      {item.included ? "Included" : "No file found"}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    flexShrink: 1,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  statTile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
  },
  error: {
    marginTop: -Spacing.one,
  },
  primaryButton: {
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    marginTop: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.two,
  },
  itemMain: {
    flex: 1,
    gap: 1,
  },
});
