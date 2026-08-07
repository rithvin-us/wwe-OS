import { ApiRequestError } from "@bop/sdk";
import type { Employee } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import { getEmployees } from "@/lib/hr";

const STATUS_TONE: Record<Employee["status"], "success" | "mutedForeground" | "warning"> = {
  Active: "success",
  Left: "mutedForeground",
  "New Joining": "warning",
};

function EmployeeRow({ employee }: { employee: Employee }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={() => router.push(`/hr/employees/${employee.id}` as never)}
      style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{employee.employee_name}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {employee.employee_code} · {employee.designation || "—"} · {employee.department || "—"}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor={STATUS_TONE[employee.status]}>
        {employee.status}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function EmployeesScreen() {
  const theme = useTheme();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (query: string) => {
    try {
      setError(null);
      const result = await getEmployees(query ? { search: query } : {});
      setEmployees(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load employees.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 250);
    return () => clearTimeout(timer);
  }, [search, load]);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Employees
          </ThemedText>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or code"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.search,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />
        </View>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : employees === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : employees.length === 0 ? (
          <ThemedText themeColor="mutedForeground" style={styles.message}>
            No employees found.
          </ThemedText>
        ) : (
          <FlatList
            data={employees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={listItemEntrance(index)}>
                <EmployeeRow employee={item} />
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
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
  message: {
    marginTop: Spacing.five,
    textAlign: "center",
  },
});
