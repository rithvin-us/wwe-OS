import { ApiRequestError } from "@bop/sdk";
import type {
  BillingCustomer,
  GenerateInvoiceInput,
  Invoice,
  InvoiceLineDraft,
  InvoiceType,
} from "@bop/shared-types";
import { computeSubtotal, formatRupees, HIGH_VALUE_THRESHOLD } from "@bop/shared-types";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getBillingCustomers } from "@/lib/finance";

const GST_RATES = ["18", "16", "12", "5", "0"];

function emptyLine(): InvoiceLineDraft {
  return { description: "", hsn: "", quantity: "1", uom: "Nos", rate: "" };
}

function previousMonth(dateStr: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface InvoiceFormValue {
  invoiceType: InvoiceType;
  customerId: string | null;
  invoiceDate: string;
  billedMonth: string;
  gstRate: string;
  lines: InvoiceLineDraft[];
}

function fromInvoice(invoice: Invoice): InvoiceFormValue {
  return {
    invoiceType: invoice.invoice_type,
    customerId: invoice.customer,
    invoiceDate: invoice.invoice_date,
    billedMonth:
      invoice.period_year && invoice.period_month
        ? `${invoice.period_year}-${String(invoice.period_month).padStart(2, "0")}`
        : previousMonth(invoice.invoice_date),
    gstRate: invoice.gst_rate,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      hsn: l.hsn,
      quantity: l.quantity,
      uom: l.uom,
      rate: l.rate,
    })),
  };
}

function toPayload(value: InvoiceFormValue): GenerateInvoiceInput {
  const lines = value.lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      description: l.description,
      hsn: l.hsn,
      quantity: l.quantity.trim() || "1",
      uom: l.uom.trim() || "Nos",
      rate: l.rate,
    }));
  const payload: GenerateInvoiceInput = {
    invoice_type: value.invoiceType,
    invoice_date: value.invoiceDate,
    customer_id: value.customerId ?? undefined,
    gst_rate: value.gstRate,
    lines,
  };
  if (value.invoiceType === "amc" && value.billedMonth) {
    const [year, month] = value.billedMonth.split("-").map(Number);
    payload.period_year = year;
    payload.period_month = month;
  }
  return payload;
}

interface Props {
  initial?: Invoice;
  onSubmit: (payload: GenerateInvoiceInput) => Promise<void>;
  submitLabel: string;
}

export function InvoiceForm({ initial, onSubmit, submitLabel }: Props) {
  const theme = useTheme();
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [value, setValue] = useState<InvoiceFormValue>(
    initial
      ? fromInvoice(initial)
      : {
          invoiceType: "sales",
          customerId: null,
          invoiceDate: todayIso(),
          billedMonth: previousMonth(todayIso()),
          gstRate: "18",
          lines: [emptyLine()],
        },
  );
  const [consigneeName, setConsigneeName] = useState(initial?.consignee_name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBillingCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, []);

  const subtotal = computeSubtotal(value.lines);
  const highValue = subtotal > HIGH_VALUE_THRESHOLD;
  const canSubmit =
    (value.customerId !== null || consigneeName.trim().length > 0) &&
    value.lines.some((l) => l.description.trim().length > 0) &&
    !submitting;

  function updateLine(index: number, patch: Partial<InvoiceLineDraft>) {
    setValue((v) => ({
      ...v,
      lines: v.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setValue((v) => ({ ...v, lines: [...v.lines, emptyLine()] }));
  }

  function removeLine(index: number) {
    setValue((v) => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = toPayload(value);
      if (!value.customerId && consigneeName.trim()) {
        payload.consignee_name = consigneeName.trim();
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save this invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="mutedForeground">
        INVOICE TYPE
      </ThemedText>
      <View style={styles.chipRow}>
        {(["sales", "amc"] as InvoiceType[]).map((t) => (
          <AnimatedPressable
            key={t}
            onPress={() => setValue((v) => ({ ...v, invoiceType: t }))}
            style={[
              styles.chip,
              {
                borderColor: value.invoiceType === t ? theme.primary : theme.border,
                backgroundColor: value.invoiceType === t ? `${theme.primary}18` : theme.card,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={
                value.invoiceType === t ? { color: theme.primary, fontWeight: "600" } : undefined
              }
            >
              {t === "sales" ? "Sales" : "AMC"}
            </ThemedText>
          </AnimatedPressable>
        ))}
      </View>

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        CUSTOMER
      </ThemedText>
      <View style={styles.chipRow}>
        {customers.map((c) => (
          <AnimatedPressable
            key={c.id}
            onPress={() => setValue((v) => ({ ...v, customerId: c.id }))}
            style={[
              styles.chip,
              {
                borderColor: value.customerId === c.id ? theme.primary : theme.border,
                backgroundColor: value.customerId === c.id ? `${theme.primary}18` : theme.card,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={
                value.customerId === c.id ? { color: theme.primary, fontWeight: "600" } : undefined
              }
            >
              {c.name}
            </ThemedText>
          </AnimatedPressable>
        ))}
      </View>
      {!value.customerId ? (
        <TextInput
          value={consigneeName}
          onChangeText={setConsigneeName}
          placeholder="Or type a one-off consignee name"
          placeholderTextColor={theme.mutedForeground}
          style={[
            styles.input,
            { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
          ]}
        />
      ) : null}

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        INVOICE DATE
      </ThemedText>
      <TextInput
        value={value.invoiceDate}
        onChangeText={(t) => setValue((v) => ({ ...v, invoiceDate: t }))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.mutedForeground}
        style={[
          styles.input,
          { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
        ]}
      />

      {value.invoiceType === "amc" ? (
        <>
          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            BILLED MONTH
          </ThemedText>
          <TextInput
            value={value.billedMonth}
            onChangeText={(t) => setValue((v) => ({ ...v, billedMonth: t }))}
            placeholder="YYYY-MM"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />
        </>
      ) : null}

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        GST RATE
      </ThemedText>
      <View style={styles.chipRow}>
        {GST_RATES.map((rate) => (
          <AnimatedPressable
            key={rate}
            onPress={() => setValue((v) => ({ ...v, gstRate: rate }))}
            style={[
              styles.chip,
              {
                borderColor: value.gstRate === rate ? theme.primary : theme.border,
                backgroundColor: value.gstRate === rate ? `${theme.primary}18` : theme.card,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={
                value.gstRate === rate ? { color: theme.primary, fontWeight: "600" } : undefined
              }
            >
              {rate}%
            </ThemedText>
          </AnimatedPressable>
        ))}
      </View>

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        LINE ITEMS
      </ThemedText>
      {value.lines.map((line, index) => (
        <View
          key={index}
          style={[styles.lineCard, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <TextInput
            value={line.description}
            onChangeText={(t) => updateLine(index, { description: t })}
            placeholder="Description"
            placeholderTextColor={theme.mutedForeground}
            style={[styles.lineInput, { color: theme.foreground, borderColor: theme.border }]}
          />
          <View style={styles.lineRow}>
            <TextInput
              value={line.quantity}
              onChangeText={(t) => updateLine(index, { quantity: t })}
              placeholder="Qty"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.lineInput,
                styles.lineInputThird,
                { color: theme.foreground, borderColor: theme.border },
              ]}
            />
            <TextInput
              value={line.uom}
              onChangeText={(t) => updateLine(index, { uom: t })}
              placeholder="UOM"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.lineInput,
                styles.lineInputThird,
                { color: theme.foreground, borderColor: theme.border },
              ]}
            />
            <TextInput
              value={line.rate}
              onChangeText={(t) => updateLine(index, { rate: t })}
              placeholder="Rate"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.lineInput,
                styles.lineInputThird,
                { color: theme.foreground, borderColor: theme.border },
              ]}
            />
          </View>
          {value.lines.length > 1 ? (
            <AnimatedPressable onPress={() => removeLine(index)}>
              <ThemedText type="small" themeColor="destructive">
                Remove line
              </ThemedText>
            </AnimatedPressable>
          ) : null}
        </View>
      ))}
      <AnimatedPressable
        onPress={addLine}
        style={[styles.addLineButton, { borderColor: theme.border }]}
      >
        <ThemedText type="small">+ Add line</ThemedText>
      </AnimatedPressable>

      <View style={[styles.subtotalRow, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="mutedForeground">
          Calculated subtotal (excl. tax)
        </ThemedText>
        <ThemedText type="smallBold">{formatRupees(subtotal)}</ThemedText>
      </View>

      {highValue ? (
        <View
          style={[
            styles.warningBanner,
            { borderColor: theme.warning, backgroundColor: `${theme.warning}18` },
          ]}
        >
          <ThemedText type="smallBold" themeColor="warning">
            High Invoice Amount Alert ({formatRupees(subtotal)})
          </ThemedText>
          <ThemedText type="small" themeColor="mutedForeground">
            Please verify rate and quantity. If a rate contains accidental zeroes (e.g. 40,05,36,000
            instead of 40,053.60), correct it above before saving.
          </ThemedText>
        </View>
      ) : null}

      {error ? (
        <ThemedText themeColor="destructive" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <AnimatedPressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color={theme.primaryForeground} />
        ) : (
          <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
            {submitLabel}
          </ThemedText>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    marginTop: Spacing.two,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  lineInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  lineRow: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  lineInputThird: {
    flex: 1,
  },
  addLineButton: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  subtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
  },
  warningBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    gap: 2,
  },
  error: {
    marginTop: -Spacing.one,
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
});
