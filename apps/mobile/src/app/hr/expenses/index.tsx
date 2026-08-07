import { ApiRequestError } from "@bop/sdk";
import type { ExpenseClaim } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatValue } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { decideExpense, getExpenseClaims } from "@/lib/hr";

function ExpenseRow({
  item,
  onDecide,
}: {
  item: ExpenseClaim;
  onDecide?: (id: string, status: "approved" | "rejected") => void;
}) {
  const theme = useTheme();
  const [deciding, setDeciding] = useState<"approved" | "rejected" | null>(null);

  async function handle(status: "approved" | "rejected") {
    setDeciding(status);
    await onDecide?.(item.id, status);
    setDeciding(null);
  }

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.rowHeader}>
        <ThemedText type="smallBold">{item.employee_name}</ThemedText>
        <ThemedText type="smallBold">{formatValue(item.amount, "currency")}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="mutedForeground">
        {item.category || "Other"} · {item.expense_date}{" "}
        {item.has_receipt ? "· Receipt attached" : ""}
      </ThemedText>
      {item.description ? <ThemedText type="small">{item.description}</ThemedText> : null}
      <ThemedText
        type="small"
        themeColor={
          item.status === "approved"
            ? "success"
            : item.status === "rejected"
              ? "destructive"
              : "warning"
        }
      >
        {item.status}
      </ThemedText>

      {onDecide ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => handle("approved")}
            disabled={deciding !== null}
            style={[styles.actionButton, { backgroundColor: `${theme.success}22` }]}
          >
            {deciding === "approved" ? (
              <ActivityIndicator size="small" color={theme.success} />
            ) : (
              <ThemedText type="small" style={{ color: theme.success, fontWeight: "600" }}>
                Approve
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            onPress={() => handle("rejected")}
            disabled={deciding !== null}
            style={[styles.actionButton, { backgroundColor: `${theme.destructive}22` }]}
          >
            {deciding === "rejected" ? (
              <ActivityIndicator size="small" color={theme.destructive} />
            ) : (
              <ThemedText type="small" style={{ color: theme.destructive, fontWeight: "600" }}>
                Reject
              </ThemedText>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function ExpensesScreen() {
  const theme = useTheme();
  const [claims, setClaims] = useState<ExpenseClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setClaims(await getExpenseClaims());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load expense claims.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(id: string, status: "approved" | "rejected") {
    try {
      await decideExpense(id, status);
      load();
    } catch {
      // Refresh already reflects the true state on next load.
    }
  }

  const pending = claims?.filter((c) => c.status === "pending") ?? [];
  const decided = claims?.filter((c) => c.status !== "pending") ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Expenses
          </ThemedText>
          <Pressable
            onPress={() => router.push("/hr/expenses/new")}
            style={[styles.newButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              New claim
            </ThemedText>
          </Pressable>
        </View>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : claims === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
              PENDING ({pending.length})
            </ThemedText>
            {pending.length === 0 ? (
              <ThemedText themeColor="mutedForeground" style={styles.emptyRow}>
                Nothing pending.
              </ThemedText>
            ) : (
              pending.map((item) => (
                <ExpenseRow key={item.id} item={item} onDecide={handleDecide} />
              ))
            )}

            <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
              DECIDED ({decided.length})
            </ThemedText>
            {decided.map((item) => (
              <ExpenseRow key={item.id} item={item} />
            ))}
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
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sectionLabel: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  emptyRow: {
    marginBottom: Spacing.two,
  },
  row: {
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: Spacing.five,
    textAlign: "center",
  },
});
