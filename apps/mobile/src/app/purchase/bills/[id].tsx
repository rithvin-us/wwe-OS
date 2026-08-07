import { ApiRequestError } from "@bop/sdk";
import type { PurchaseBill } from "@bop/shared-types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatValue } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  deleteBill,
  getPurchaseBill,
  markBillPaid,
  openBillFile,
  unmarkBillPaid,
  updateBill,
} from "@/lib/purchase";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

export default function BillDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sellerName, setSellerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalRate, setTotalRate] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const result = await getPurchaseBill(id);
      setBill(result);
      setSellerName(result.seller_name);
      setInvoiceNumber(result.invoice_number);
      setTotalRate(result.total_rate);
      setGstNumber(result.gst_number);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this bill."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!bill) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBill(bill.id, {
        seller_name: sellerName,
        invoice_number: invoiceNumber,
        total_rate: Number(totalRate),
        gst_number: gstNumber,
      });
      setBill(updated);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save these changes."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid() {
    if (!bill) return;
    setPaymentBusy(true);
    setError(null);
    try {
      const updated =
        bill.payment_status === "paid"
          ? await unmarkBillPaid(bill.id)
          : await markBillPaid(bill.id);
      setBill(updated);
    } catch (err) {
      setError(errorMessage(err, "Couldn't update payment status."));
    } finally {
      setPaymentBusy(false);
    }
  }

  function confirmDelete() {
    if (!bill) return;
    Alert.alert("Delete this bill?", "This removes the digitized record permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBill(bill.id);
            router.back();
          } catch (err) {
            setError(errorMessage(err, "Couldn't delete this bill."));
          }
        },
      },
    ]);
  }

  async function handleViewFile() {
    if (!bill) return;
    setOpening(true);
    try {
      await openBillFile(bill.id);
    } catch (err) {
      setError(errorMessage(err, "Couldn't open the document."));
    } finally {
      setOpening(false);
    }
  }

  if (error && !bill) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ThemedText themeColor="destructive">{error}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!bill) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>
              {bill.seller_name}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={bill.payment_status === "paid" ? "success" : "warning"}
            >
              {bill.payment_status === "paid" ? "Paid" : "Unpaid"}
            </ThemedText>
          </View>
          <ThemedText themeColor="mutedForeground">
            {formatValue(Number(bill.total_rate), "currency")} · {bill.source_channel}
          </ThemedText>

          <View
            style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Correct OCR values
            </ThemedText>
            <ThemedText type="small" themeColor="mutedForeground">
              Vendor name
            </ThemedText>
            <TextInput
              value={sellerName}
              onChangeText={setSellerName}
              style={[styles.input, { color: theme.foreground, borderColor: theme.border }]}
            />
            <ThemedText type="small" themeColor="mutedForeground">
              Invoice number
            </ThemedText>
            <TextInput
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              style={[styles.input, { color: theme.foreground, borderColor: theme.border }]}
            />
            <ThemedText type="small" themeColor="mutedForeground">
              Total amount
            </ThemedText>
            <TextInput
              value={totalRate}
              onChangeText={setTotalRate}
              keyboardType="decimal-pad"
              style={[styles.input, { color: theme.foreground, borderColor: theme.border }]}
            />
            <ThemedText type="small" themeColor="mutedForeground">
              GSTIN
            </ThemedText>
            <TextInput
              value={gstNumber}
              onChangeText={setGstNumber}
              autoCapitalize="characters"
              style={[styles.input, { color: theme.foreground, borderColor: theme.border }]}
            />
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                  Save & mark processed
                </ThemedText>
              )}
            </Pressable>
          </View>

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={togglePaid}
              disabled={paymentBusy}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              {paymentBusy ? (
                <ActivityIndicator color={theme.foreground} />
              ) : (
                <ThemedText>
                  {bill.payment_status === "paid" ? "Mark unpaid" : "Mark paid"}
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              onPress={handleViewFile}
              disabled={opening}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              {opening ? (
                <ActivityIndicator color={theme.foreground} />
              ) : (
                <ThemedText>View document</ThemedText>
              )}
            </Pressable>
          </View>
          <Pressable onPress={confirmDelete} style={styles.deleteButton}>
            <ThemedText themeColor="destructive">Delete bill</ThemedText>
          </Pressable>
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
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    flexShrink: 1,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  sectionTitle: {
    marginBottom: Spacing.one,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    marginBottom: Spacing.one,
  },
  primaryButton: {
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  error: {
    marginTop: -Spacing.one,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
