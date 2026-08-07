import { ApiRequestError } from "@bop/sdk";
import type { ReportCatalogEntry, ReportExportRecord, ReportFormat } from "@bop/shared-types";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import {
  downloadReportFile,
  getExportSignedUrl,
  getReportCatalog,
  getReportHistory,
  runReport,
} from "@/lib/reports";

const FORMATS: ReportFormat[] = ["csv", "xlsx", "pdf", "html"];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

function CatalogRow({ entry }: { entry: ReportCatalogEntry }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const result = await runReport({ key: entry.key, format });
      if (result.download_url) {
        await downloadReportFile(result.download_url);
      } else {
        setError("Report ran but produced no file.");
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't run this report."));
    } finally {
      setRunning(false);
    }
  }

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <AnimatedPressable onPress={() => setExpanded((e) => !e)} style={styles.rowHeader}>
        <View style={styles.rowMain}>
          <ThemedText type="smallBold">{entry.label}</ThemedText>
          <ThemedText type="small" themeColor="mutedForeground">
            {entry.description}
          </ThemedText>
        </View>
        <ThemedText themeColor="mutedForeground">{expanded ? "▲" : "▼"}</ThemedText>
      </AnimatedPressable>

      {expanded ? (
        <View style={styles.rowExpanded}>
          <View style={styles.chipRow}>
            {FORMATS.map((f) => (
              <AnimatedPressable
                key={f}
                onPress={() => setFormat(f)}
                style={[
                  styles.chip,
                  {
                    borderColor: format === f ? theme.primary : theme.border,
                    backgroundColor: format === f ? `${theme.primary}18` : theme.background,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={format === f ? { color: theme.primary, fontWeight: "600" } : undefined}
                >
                  {f.toUpperCase()}
                </ThemedText>
              </AnimatedPressable>
            ))}
          </View>
          {error ? (
            <ThemedText type="small" themeColor="destructive">
              {error}
            </ThemedText>
          ) : null}
          <AnimatedPressable
            onPress={handleRun}
            disabled={running}
            style={[
              styles.runButton,
              { backgroundColor: theme.primary, opacity: running ? 0.6 : 1 },
            ]}
          >
            {running ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Run & download
              </ThemedText>
            )}
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );
}

function HistoryRow({ item }: { item: ReportExportRecord }) {
  const theme = useTheme();
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      const { url } = await getExportSignedUrl(item.id);
      await downloadReportFile(url);
    } catch {
      // The file may have expired/been cleaned up — a quiet failure here is
      // fine, the row itself still tells the operator the export happened.
    } finally {
      setOpening(false);
    }
  }

  return (
    <AnimatedPressable
      onPress={handleOpen}
      disabled={opening}
      style={[styles.historyRow, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{item.title}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {item.format.toUpperCase()} · {item.row_count} rows · {item.created_at.slice(0, 10)}
        </ThemedText>
      </View>
      {opening ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : (
        <ThemedText type="small">↓</ThemedText>
      )}
    </AnimatedPressable>
  );
}

export default function ReportsScreen() {
  const theme = useTheme();
  const [catalog, setCatalog] = useState<ReportCatalogEntry[] | null>(null);
  const [history, setHistory] = useState<ReportExportRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [catalogResult, historyResult] = await Promise.all([
        getReportCatalog(),
        getReportHistory(),
      ]);
      setCatalog(catalogResult);
      setHistory(historyResult);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load reports."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Reports
          </ThemedText>

          {error ? (
            <ThemedText themeColor="destructive">{error}</ThemedText>
          ) : catalog === null ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (
            <>
              <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
                CATALOG
              </ThemedText>
              {catalog.length === 0 ? (
                <ThemedText themeColor="mutedForeground">
                  No reports available for your permissions yet.
                </ThemedText>
              ) : (
                <View style={styles.list}>
                  {catalog.map((entry, index) => (
                    <Animated.View key={entry.key} entering={listItemEntrance(index)}>
                      <CatalogRow entry={entry} />
                    </Animated.View>
                  ))}
                </View>
              )}

              <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
                RECENT EXPORTS
              </ThemedText>
              {history === null || history.length === 0 ? (
                <ThemedText themeColor="mutedForeground">No exports yet.</ThemedText>
              ) : (
                <View style={styles.list}>
                  {history.map((item, index) => (
                    <Animated.View key={item.id} entering={listItemEntrance(index)}>
                      <HistoryRow item={item} />
                    </Animated.View>
                  ))}
                </View>
              )}
            </>
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
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  loader: {
    marginTop: Spacing.four,
  },
  sectionLabel: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
  },
  rowMain: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.two,
  },
  rowExpanded: {
    padding: Spacing.three,
    paddingTop: 0,
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
  },
  runButton: {
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
  },
});
