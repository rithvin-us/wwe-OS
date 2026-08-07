import { ApiRequestError } from "@bop/sdk";
import type { Invoice } from "@bop/shared-types";
import { formatRupees } from "@bop/shared-types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { cancelInvoice, getInvoice, openInvoicePdf, openInvoiceWorkbook } from "@/lib/finance";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

export default function InvoiceDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<"pdf" | "workbook" | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setInvoice(await getInvoice(id));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this invoice."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpen(kind: "pdf" | "workbook") {
    if (!invoice) return;
    setOpening(kind);
    try {
      await (kind === "pdf" ? openInvoicePdf(invoice.id) : openInvoiceWorkbook(invoice.id));
    } catch (err) {
      setError(errorMessage(err, "Couldn't open that file."));
    } finally {
      setOpening(null);
    }
  }

  async function handleCancel() {
    if (!invoice || !cancelReason.trim()) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await cancelInvoice(invoice.id, cancelReason.trim());
      setInvoice(updated);
      setShowCancel(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't cancel this invoice."));
    } finally {
      setCancelling(false);
    }
  }

  if (error && !invoice) {
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
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>
              {invoice.number}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={invoice.status === "issued" ? "success" : "destructive"}
            >
              {invoice.status === "issued" ? "Issued" : "Cancelled"}
            </ThemedText>
          </View>
          <ThemedText themeColor="mutedForeground">
            {invoice.customer_name || invoice.consignee_name || "One-off"} · {invoice.invoice_date}
            {invoice.period_text ? ` · ${invoice.period_text}` : ""}
          </ThemedText>

          <View
            style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            {invoice.lines.map((line) => (
              <View key={line.position} style={styles.lineRow}>
                <ThemedText type="small" style={styles.lineDescription}>
                  {line.description}
                </ThemedText>
                <ThemedText type="small" themeColor="mutedForeground">
                  {line.quantity} {line.uom} × {formatRupees(line.rate)}
                </ThemedText>
                <ThemedText type="small">{formatRupees(line.amount)}</ThemedText>
              </View>
            ))}
            <View style={[styles.totalsBlock, { borderColor: theme.border }]}>
              <View style={styles.totalRow}>
                <ThemedText type="small" themeColor="mutedForeground">
                  Subtotal
                </ThemedText>
                <ThemedText type="small">{formatRupees(invoice.subtotal)}</ThemedText>
              </View>
              {invoice.tax_mode === "igst" ? (
                <View style={styles.totalRow}>
                  <ThemedText type="small" themeColor="mutedForeground">
                    IGST
                  </ThemedText>
                  <ThemedText type="small">{formatRupees(invoice.igst_amount)}</ThemedText>
                </View>
              ) : (
                <>
                  <View style={styles.totalRow}>
                    <ThemedText type="small" themeColor="mutedForeground">
                      CGST
                    </ThemedText>
                    <ThemedText type="small">{formatRupees(invoice.cgst_amount)}</ThemedText>
                  </View>
                  <View style={styles.totalRow}>
                    <ThemedText type="small" themeColor="mutedForeground">
                      SGST
                    </ThemedText>
                    <ThemedText type="small">{formatRupees(invoice.sgst_amount)}</ThemedText>
                  </View>
                </>
              )}
              <View style={styles.totalRow}>
                <ThemedText type="smallBold">Total</ThemedText>
                <ThemedText type="smallBold">{formatRupees(invoice.total)}</ThemedText>
              </View>
            </View>
          </View>

          {invoice.status === "cancelled" && invoice.cancellation_reason ? (
            <ThemedText type="small" themeColor="destructive">
              Cancelled: {invoice.cancellation_reason}
            </ThemedText>
          ) : null}

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actionRow}>
            {invoice.pdf_url ? (
              <AnimatedPressable
                onPress={() => handleOpen("pdf")}
                disabled={opening !== null}
                style={[styles.secondaryButton, { borderColor: theme.border }]}
              >
                {opening === "pdf" ? (
                  <ActivityIndicator color={theme.foreground} />
                ) : (
                  <ThemedText>Open PDF</ThemedText>
                )}
              </AnimatedPressable>
            ) : null}
            {invoice.download_url ? (
              <AnimatedPressable
                onPress={() => handleOpen("workbook")}
                disabled={opening !== null}
                style={[styles.secondaryButton, { borderColor: theme.border }]}
              >
                {opening === "workbook" ? (
                  <ActivityIndicator color={theme.foreground} />
                ) : (
                  <ThemedText>Workbook</ThemedText>
                )}
              </AnimatedPressable>
            ) : null}
          </View>

          {invoice.status === "issued" ? (
            <>
              <AnimatedPressable
                onPress={() => router.push(`/invoices/${invoice.id}/edit` as never)}
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                  Correct invoice
                </ThemedText>
              </AnimatedPressable>

              {showCancel ? (
                <View style={[styles.cancelBlock, { borderColor: theme.destructive }]}>
                  <TextInput
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    placeholder="Reason for cancelling"
                    placeholderTextColor={theme.mutedForeground}
                    style={[
                      styles.input,
                      {
                        color: theme.foreground,
                        borderColor: theme.border,
                        backgroundColor: theme.card,
                      },
                    ]}
                  />
                  <AnimatedPressable
                    onPress={handleCancel}
                    disabled={!cancelReason.trim() || cancelling}
                    style={[
                      styles.primaryButton,
                      {
                        backgroundColor: theme.destructive,
                        opacity: !cancelReason.trim() || cancelling ? 0.5 : 1,
                      },
                    ]}
                  >
                    {cancelling ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
                        Confirm cancel
                      </ThemedText>
                    )}
                  </AnimatedPressable>
                </View>
              ) : (
                <AnimatedPressable
                  onPress={() =>
                    Alert.alert("Cancel this invoice?", "You’ll need to give a reason.", [
                      { text: "Never mind", style: "cancel" },
                      { text: "Continue", onPress: () => setShowCancel(true) },
                    ])
                  }
                  style={styles.cancelLink}
                >
                  <ThemedText themeColor="destructive">Cancel invoice</ThemedText>
                </AnimatedPressable>
              )}
            </>
          ) : null}
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
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  lineRow: {
    gap: 2,
  },
  lineDescription: {
    fontWeight: "600",
  },
  totalsBlock: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
    gap: 4,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  primaryButton: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
