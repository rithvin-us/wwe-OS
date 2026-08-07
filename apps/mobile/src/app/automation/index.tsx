import { ApiRequestError } from "@bop/sdk";
import type { AutomationRule, AutomationRun } from "@bop/shared-types";
import { STUB_DESTINATIONS } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { deleteRule, getRules, getRunHistory, runRuleNow, setRuleActive } from "@/lib/automation";
import { listItemEntrance } from "@/lib/motion";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

function RuleRow({ rule, onChanged }: { rule: AutomationRule; onChanged: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState<"run" | "toggle" | "delete" | null>(null);
  const isStub = STUB_DESTINATIONS.includes(rule.destination);

  async function handleRun() {
    setBusy("run");
    try {
      const run = await runRuleNow(rule.id);
      onChanged();
      Alert.alert(
        run.status === "success" ? "Run complete" : "Run failed",
        `${run.item_count} item(s) collected.`,
      );
    } catch (err) {
      Alert.alert("Couldn't run this rule", errorMessage(err, "Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function handleToggle() {
    setBusy("toggle");
    try {
      await setRuleActive(rule.id, !rule.is_active);
      onChanged();
    } catch {
      Alert.alert("Couldn't update this rule.");
    } finally {
      setBusy(null);
    }
  }

  function handleDelete() {
    Alert.alert("Delete this rule?", rule.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await deleteRule(rule.id);
            onChanged();
          } catch {
            Alert.alert("Couldn't delete this rule.");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <AnimatedPressable
        onPress={() => router.push(`/automation/${rule.id}/edit` as never)}
        style={styles.rowMain}
      >
        <ThemedText type="smallBold">{rule.name}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {rule.destination.replace("_", " ")} · {rule.cadence} ·{" "}
          {rule.is_active ? "Active" : "Paused"}
        </ThemedText>
        {rule.last_run_at ? (
          <ThemedText type="small" themeColor="mutedForeground">
            Last ran {rule.last_run_at.slice(0, 10)}
          </ThemedText>
        ) : null}
      </AnimatedPressable>
      <View style={styles.rowActions}>
        <AnimatedPressable onPress={handleRun} disabled={busy !== null || isStub}>
          {busy === "run" ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText type="small" themeColor={isStub ? "mutedForeground" : "primary"}>
              Run now
            </ThemedText>
          )}
        </AnimatedPressable>
        <AnimatedPressable onPress={handleToggle} disabled={busy !== null}>
          {busy === "toggle" ? (
            <ActivityIndicator size="small" color={theme.mutedForeground} />
          ) : (
            <ThemedText type="small" themeColor="mutedForeground">
              {rule.is_active ? "Pause" : "Resume"}
            </ThemedText>
          )}
        </AnimatedPressable>
        <AnimatedPressable onPress={handleDelete} disabled={busy !== null}>
          {busy === "delete" ? (
            <ActivityIndicator size="small" color={theme.destructive} />
          ) : (
            <ThemedText type="small" themeColor="destructive">
              Delete
            </ThemedText>
          )}
        </AnimatedPressable>
      </View>
    </View>
  );
}

function RunRow({ run }: { run: AutomationRun }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={() => router.push(`/automation/runs/${run.id}` as never)}
      style={[styles.runRow, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{run.rule_name}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {run.triggered_by === "manual" ? "Manual" : "Scheduled"} · {run.item_count} items ·{" "}
          {run.created_at.slice(0, 10)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor={run.status === "success" ? "success" : "destructive"}>
        {run.status === "success" ? "Success" : "Failed"}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function AutomationScreen() {
  const theme = useTheme();
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [runs, setRuns] = useState<AutomationRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rulesResult, runsResult] = await Promise.all([getRules(), getRunHistory()]);
      setRules(rulesResult);
      setRuns(runsResult);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load automation."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Automation
          </ThemedText>
          <AnimatedPressable
            onPress={() => router.push("/automation/new")}
            style={[styles.newButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              New rule
            </ThemedText>
          </AnimatedPressable>
        </View>
        <ThemedText type="small" themeColor="mutedForeground" style={styles.tagline}>
          Collect tagged records on demand — a downloaded package, a generated report, or an auditor
          folder. Nothing untagged is ever collected, and nothing is emailed or uploaded
          automatically yet.
        </ThemedText>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : rules === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
              RULES
            </ThemedText>
            {rules.length === 0 ? (
              <ThemedText themeColor="mutedForeground">No rules yet.</ThemedText>
            ) : (
              rules.map((rule, index) => (
                <Animated.View key={rule.id} entering={listItemEntrance(index)}>
                  <RuleRow rule={rule} onChanged={load} />
                </Animated.View>
              ))
            )}

            <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
              RECENT RUNS
            </ThemedText>
            {runs === null || runs.length === 0 ? (
              <ThemedText themeColor="mutedForeground">No runs yet.</ThemedText>
            ) : (
              runs.slice(0, 10).map((run, index) => (
                <Animated.View key={run.id} entering={listItemEntrance(index)}>
                  <RunRow run={run} />
                </Animated.View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  newButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tagline: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sectionLabel: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  row: {
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.two,
  },
  rowMain: {
    gap: 2,
  },
  rowActions: {
    flexDirection: "row",
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  runRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: "center",
  },
});
