import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AutomationRuleForm } from "@/components/automation-rule-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { createRule } from "@/lib/automation";

export default function NewAutomationRuleScreen() {
  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            New automation rule
          </ThemedText>
          <AutomationRuleForm
            submitLabel="Create rule"
            onSubmit={async (input) => {
              await createRule(input);
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
