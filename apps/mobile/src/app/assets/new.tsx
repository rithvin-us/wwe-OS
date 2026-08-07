import { ApiRequestError } from "@bop/sdk";
import type { ChallanType, Site } from "@bop/shared-types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { generateDC, getSites } from "@/lib/assets";

interface ItemDraft {
  description: string;
  qty: string;
  unit: string;
}

function emptyItem(): ItemDraft {
  return { description: "", qty: "1", unit: "Nos" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewDeliveryChallanScreen() {
  const theme = useTheme();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [dcType, setDcType] = useState<ChallanType>("non_returnable");
  const [dcNumber, setDcNumber] = useState("");
  const [date, setDate] = useState(todayIso());
  const [deliverTo, setDeliverTo] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSites()
      .then(setSites)
      .catch(() => setSites([]));
  }, []);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const canSubmit =
    dcNumber.trim().length > 0 &&
    date.trim().length > 0 &&
    items.some((it) => it.description.trim().length > 0) &&
    !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await generateDC({
        site_id: siteId ?? undefined,
        dc_type: dcType,
        dc_number: dcNumber.trim(),
        date,
        deliver_to: deliverTo || undefined,
        items: items
          .filter((it) => it.description.trim())
          .map((it) => ({
            id: it.description.trim(),
            qty: Number.parseFloat(it.qty) || 1,
            unit: it.unit || "Nos",
          })),
      });
      router.replace("/assets" as never);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't generate this DC.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Generate delivery challan
          </ThemedText>

          <ThemedText type="smallBold" themeColor="mutedForeground">
            SITE (OPTIONAL)
          </ThemedText>
          <View style={styles.chipRow}>
            {sites.map((s) => (
              <AnimatedPressable
                key={s.id}
                onPress={() => setSiteId(siteId === s.id ? null : s.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: siteId === s.id ? theme.primary : theme.border,
                    backgroundColor: siteId === s.id ? `${theme.primary}18` : theme.card,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={siteId === s.id ? { color: theme.primary, fontWeight: "600" } : undefined}
                >
                  {s.name}
                </ThemedText>
              </AnimatedPressable>
            ))}
          </View>
          {!siteId ? (
            <TextInput
              value={deliverTo}
              onChangeText={setDeliverTo}
              placeholder="Or type a delivery address"
              placeholderTextColor={theme.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.textArea,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          ) : null}

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            TYPE
          </ThemedText>
          <View style={styles.chipRow}>
            {(["non_returnable", "returnable"] as ChallanType[]).map((t) => (
              <AnimatedPressable
                key={t}
                onPress={() => setDcType(t)}
                style={[
                  styles.chip,
                  {
                    borderColor: dcType === t ? theme.primary : theme.border,
                    backgroundColor: dcType === t ? `${theme.primary}18` : theme.card,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={dcType === t ? { color: theme.primary, fontWeight: "600" } : undefined}
                >
                  {t === "returnable" ? "Returnable" : "Non-returnable"}
                </ThemedText>
              </AnimatedPressable>
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            DC NUMBER
          </ThemedText>
          <TextInput
            value={dcNumber}
            onChangeText={setDcNumber}
            placeholder="e.g. 28/2026-27"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            DATE
          </ThemedText>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            ITEMS
          </ThemedText>
          {items.map((item, index) => (
            <View
              key={index}
              style={[styles.itemCard, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <TextInput
                value={item.description}
                onChangeText={(t) => updateItem(index, { description: t })}
                placeholder="Description"
                placeholderTextColor={theme.mutedForeground}
                style={[styles.itemInput, { color: theme.foreground, borderColor: theme.border }]}
              />
              <View style={styles.itemRow}>
                <TextInput
                  value={item.qty}
                  onChangeText={(t) => updateItem(index, { qty: t })}
                  placeholder="Qty"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.mutedForeground}
                  style={[
                    styles.itemInput,
                    styles.itemInputHalf,
                    { color: theme.foreground, borderColor: theme.border },
                  ]}
                />
                <TextInput
                  value={item.unit}
                  onChangeText={(t) => updateItem(index, { unit: t })}
                  placeholder="Unit"
                  placeholderTextColor={theme.mutedForeground}
                  style={[
                    styles.itemInput,
                    styles.itemInputHalf,
                    { color: theme.foreground, borderColor: theme.border },
                  ]}
                />
              </View>
              {items.length > 1 ? (
                <AnimatedPressable onPress={() => removeItem(index)}>
                  <ThemedText type="small" themeColor="destructive">
                    Remove item
                  </ThemedText>
                </AnimatedPressable>
              ) : null}
            </View>
          ))}
          <AnimatedPressable
            onPress={addItem}
            style={[styles.addItemButton, { borderColor: theme.border }]}
          >
            <ThemedText type="small">+ Add item</ThemedText>
          </AnimatedPressable>

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
                Generate
              </ThemedText>
            )}
          </AnimatedPressable>
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
  textArea: {
    height: 72,
    paddingTop: Spacing.two,
    textAlignVertical: "top",
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  itemInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  itemRow: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  itemInputHalf: {
    flex: 1,
  },
  addItemButton: {
    height: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
