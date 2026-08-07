import { ApiRequestError } from "@bop/sdk";
import type { BillStatus, PurchaseBill } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatValue } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import { getPurchaseBills } from "@/lib/purchase";

const FILTERS: { label: string; value: BillStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Processed", value: "processed" },
  { label: "Needs attention", value: "needs_attention" },
];

function BillRow({ bill }: { bill: PurchaseBill }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={() => router.push(`/purchase/bills/${bill.id}` as never)}
      style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{bill.seller_name}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {bill.invoice_number || "No invoice #"} · {bill.purchase_date}
        </ThemedText>
      </View>
      <View style={styles.rowEnd}>
        <ThemedText type="smallBold">{formatValue(Number(bill.total_rate), "currency")}</ThemedText>
        <ThemedText type="small" themeColor={bill.status === "processed" ? "success" : "warning"}>
          {bill.status === "processed" ? "Processed" : "Needs attention"}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

export default function BillsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<BillStatus | undefined>(undefined);
  const [bills, setBills] = useState<PurchaseBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: BillStatus | undefined) => {
    try {
      setError(null);
      setBills(await getPurchaseBills(status ? { status } : {}));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load bills.");
    }
  }, []);

  useEffect(() => {
    setBills(null);
    load(filter);
  }, [filter, load]);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Bills
          </ThemedText>
          <AnimatedPressable
            onPress={() => router.push("/purchase/scan")}
            style={[styles.scanButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              Scan a bill
            </ThemedText>
          </AnimatedPressable>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <AnimatedPressable
              key={f.label}
              onPress={() => setFilter(f.value)}
              style={[
                styles.filterChip,
                {
                  borderColor: filter === f.value ? theme.primary : theme.border,
                  backgroundColor: filter === f.value ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={filter === f.value ? { color: theme.primary, fontWeight: "600" } : undefined}
              >
                {f.label}
              </ThemedText>
            </AnimatedPressable>
          ))}
        </View>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : bills === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : bills.length === 0 ? (
          <ThemedText themeColor="mutedForeground" style={styles.message}>
            No bills here yet.
          </ThemedText>
        ) : (
          <FlatList
            data={bills}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={listItemEntrance(index)}>
                <BillRow bill={item} />
              </Animated.View>
            )}
          />
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
  scanButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowEnd: {
    alignItems: "flex-end",
    gap: 2,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: "center",
  },
});
