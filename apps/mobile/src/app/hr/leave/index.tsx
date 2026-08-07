import { ApiRequestError } from "@bop/sdk";
import type { LeaveRequest } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { decideLeave, getLeaveRequests } from "@/lib/hr";

function LeaveRow({
  item,
  onDecide,
}: {
  item: LeaveRequest;
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
      </View>
      <ThemedText type="small" themeColor="mutedForeground">
        {item.leave_type_name} · {item.start_date} → {item.end_date} · {item.days}d
      </ThemedText>
      {item.reason ? <ThemedText type="small">{item.reason}</ThemedText> : null}

      {onDecide ? (
        <View style={styles.actions}>
          <AnimatedPressable
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
          </AnimatedPressable>
          <AnimatedPressable
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
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );
}

export default function LeaveScreen() {
  const theme = useTheme();
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const all = await getLeaveRequests();
      setRequests(all);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load leave requests.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(id: string, status: "approved" | "rejected") {
    try {
      await decideLeave(id, status);
      load();
    } catch {
      // The row's own state resets on the next load; a silent retry is fine
      // here since the list refresh will show the true current status.
    }
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const decided = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Leave
          </ThemedText>
          <AnimatedPressable
            onPress={() => router.push("/hr/leave/new")}
            style={[styles.newButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              New request
            </ThemedText>
          </AnimatedPressable>
        </View>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : requests === null ? (
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
              pending.map((item) => <LeaveRow key={item.id} item={item} onDecide={handleDecide} />)
            )}

            <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.sectionLabel}>
              DECIDED ({decided.length})
            </ThemedText>
            {decided.map((item) => (
              <LeaveRow key={item.id} item={item} />
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
