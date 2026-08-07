import { ApiRequestError } from "@bop/sdk";
import type { Invoice } from "@bop/shared-types";
import { formatRupees } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import { getInvoices } from "@/lib/finance";

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={() => router.push(`/invoices/${invoice.id}` as never)}
      style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">
          {invoice.number}
          {invoice.revision > 1 ? ` · Rev ${invoice.revision}` : ""}
        </ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {invoice.customer_name || invoice.consignee_name || "One-off"} · {invoice.invoice_date}
        </ThemedText>
      </View>
      <View style={styles.rowEnd}>
        <ThemedText type="smallBold">{formatRupees(invoice.total)}</ThemedText>
        <ThemedText
          type="small"
          themeColor={invoice.status === "issued" ? "success" : "destructive"}
        >
          {invoice.status === "issued" ? "Issued" : "Cancelled"}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

export default function InvoicesScreen() {
  const theme = useTheme();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setInvoices(await getInvoices());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load invoices.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const thisFyTotal =
    invoices && invoices.length > 0
      ? invoices
          .filter((i) => i.financial_year === invoices[0].financial_year && i.status === "issued")
          .reduce((acc, i) => acc + (Number.parseFloat(i.total) || 0), 0)
      : 0;

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Invoices
          </ThemedText>
          <View style={styles.headerActions}>
            <AnimatedPressable
              onPress={() => router.push("/customers")}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              <ThemedText type="small">Customers</ThemedText>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/invoices/new")}
              style={[styles.newButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Generate
              </ThemedText>
            </AnimatedPressable>
          </View>
        </View>

        {invoices && invoices.length > 0 ? (
          <View
            style={[styles.summaryCard, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <ThemedText type="small" themeColor="mutedForeground">
              Billed this FY ({invoices[0].financial_year})
            </ThemedText>
            <ThemedText type="title" style={styles.summaryValue}>
              {formatRupees(thisFyTotal)}
            </ThemedText>
          </View>
        ) : null}

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : invoices === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : invoices.length === 0 ? (
          <ThemedText themeColor="mutedForeground" style={styles.message}>
            No invoices yet.
          </ThemedText>
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={listItemEntrance(index)}>
                <InvoiceRow invoice={item} />
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
  headerActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  newButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  summaryValue: {
    fontSize: 22,
    lineHeight: 28,
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
