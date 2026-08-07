import { ApiRequestError } from "@bop/sdk";
import type { AutomationRule } from "@bop/shared-types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AutomationRuleForm } from "@/components/automation-rule-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getRules, updateRule } from "@/lib/automation";

export default function EditAutomationRuleScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      // No single-rule GET is exposed on this list-only endpoint on web
      // either — the rules list is always small, find it there.
      const rules = await getRules();
      const found = rules.find((r) => r.id === id);
      if (!found) throw new Error("Rule not found.");
      setRule(found);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load this rule.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <ThemedView style={styles.container} animated>
        <SafeAreaView style={styles.center}>
          <ThemedText themeColor="destructive">{error}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!rule) {
    return (
      <ThemedView style={styles.container} animated>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Edit {rule.name}
          </ThemedText>
          <AutomationRuleForm
            initial={rule}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateRule(rule.id, input);
              router.replace("/automation" as never);
            }}
          />
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
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    marginBottom: Spacing.two,
  },
});
