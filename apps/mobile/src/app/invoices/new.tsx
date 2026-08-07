import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InvoiceForm } from "@/components/invoice-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { generateInvoice } from "@/lib/finance";

export default function NewInvoiceScreen() {
  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Generate invoice
          </ThemedText>
          <InvoiceForm
            submitLabel="Generate invoice"
            onSubmit={async (payload) => {
              const invoice = await generateInvoice(payload);
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
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
});
