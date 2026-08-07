import { ApiRequestError } from "@bop/sdk";
import type { Employee, LeaveType } from "@bop/shared-types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { createLeaveRequest, getEmployees, getLeaveTypes } from "@/lib/hr";

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
    <Pressable
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
    </Pressable>
  );
}

export default function NewLeaveRequestScreen() {
  const theme = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmployees({ status: "Active" })
      .then(setEmployees)
      .catch(() => setEmployees([]));
    getLeaveTypes()
      .then(setLeaveTypes)
      .catch(() => setLeaveTypes([]));
  }, []);

  const canSubmit = employeeId && leaveTypeId && startDate && endDate && !submitting;

  async function handleSubmit() {
    if (!employeeId || !leaveTypeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createLeaveRequest({
        employee: employeeId,
        leave_type: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't submit this request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            New leave request
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
            LEAVE TYPE
          </ThemedText>
          <View style={styles.chipRow}>
            {leaveTypes.map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                selected={leaveTypeId === t.id}
                onPress={() => setLeaveTypeId(t.id)}
              />
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            START DATE
          </ThemedText>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            END DATE
          </ThemedText>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            REASON (OPTIONAL)
          </ThemedText>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="What's this for?"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              styles.textArea,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
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
                Submit request
              </ThemedText>
            )}
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
