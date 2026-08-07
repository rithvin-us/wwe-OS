import { ApiRequestError } from "@bop/sdk";
import type { Invoice } from "@bop/shared-types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InvoiceForm } from "@/components/invoice-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { correctInvoice, getInvoice } from "@/lib/finance";

export default function EditInvoiceScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setInvoice(await getInvoice(id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load this invoice.");
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

  if (!invoice) {
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
            Correct {invoice.number}
          </ThemedText>
          <ThemedText type="small" themeColor="mutedForeground" style={styles.hint}>
            This recomputes the whole invoice under the same number and bumps the revision — not a
            partial edit.
          </ThemedText>
          <InvoiceForm
            initial={invoice}
            submitLabel="Save correction"
            onSubmit={async (payload) => {
              await correctInvoice(invoice.id, payload);
              router.replace(`/invoices/${invoice.id}` as never);
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
  },
  hint: {
    marginBottom: Spacing.two,
  },
});
