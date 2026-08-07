import { ApiRequestError } from "@bop/sdk";
import type { Employee } from "@bop/shared-types";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { createExpenseClaim, getEmployees } from "@/lib/hr";
import type { LocalFile } from "@/lib/local-file";

const CATEGORIES = ["Travel", "Materials", "Food", "Fuel", "Repairs", "Other"];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? `${theme.primary}18` : theme.card,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={selected ? { color: theme.primary, fontWeight: "600" } : undefined}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function NewExpenseClaimScreen() {
  const theme = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [category, setCategory] = useState("Other");
  const [expenseDate, setExpenseDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<LocalFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmployees({ status: "Active" })
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  const canSubmit = employeeId && expenseDate && Number(amount) > 0 && !submitting;

  async function attachReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setReceipt({ uri: picked.assets[0].uri, name: "receipt.jpg", type: "image/jpeg" });
  }

  async function handleSubmit() {
    if (!employeeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createExpenseClaim(
        {
          employee: employeeId,
          expense_date: expenseDate,
          amount: Number(amount),
          category,
          description: description || undefined,
        },
        receipt ?? undefined,
      );
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't submit this claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            New expense claim
          </ThemedText>

          <ThemedText type="smallBold" themeColor="mutedForeground">
            EMPLOYEE
          </ThemedText>
          <View style={styles.chipRow}>
            {employees.map((e) => (
              <Chip
                key={e.id}
                label={e.employee_name}
                selected={employeeId === e.id}
                onPress={() => setEmployeeId(e.id)}
              />
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            CATEGORY
          </ThemedText>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            DATE
          </ThemedText>
          <TextInput
            value={expenseDate}
            onChangeText={setExpenseDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            AMOUNT (₹)
          </ThemedText>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            DESCRIPTION (OPTIONAL)
          </ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What was this for?"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              styles.textArea,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            RECEIPT (OPTIONAL)
          </ThemedText>
          <AnimatedPressable
            onPress={attachReceipt}
            style={[
              styles.receiptButton,
              { borderColor: theme.border, backgroundColor: theme.card },
            ]}
          >
            <ThemedText type="small">
              {receipt ? "Receipt attached — tap to change" : "Attach a photo"}
            </ThemedText>
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
                Submit claim
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
    height: 88,
    paddingTop: Spacing.two,
    textAlignVertical: "top",
  },
  receiptButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    marginTop: Spacing.two,
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.four,
  },
});
