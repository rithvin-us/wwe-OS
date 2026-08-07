import { ApiRequestError } from "@bop/sdk";
import type { Employee } from "@bop/shared-types";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { enrollFace, getEmployee } from "@/lib/hr";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="mutedForeground">
        {label}
      </ThemedText>
      <ThemedText>{value || "—"}</ThemedText>
    </View>
  );
}

export default function EmployeeDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const result = await getEmployee(id);
      setEmployee(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load this employee.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleEnroll() {
    if (!employee) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setEnrollMessage("Photo library access is needed to enroll a face.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;

    setEnrolling(true);
    setEnrollMessage(null);
    try {
      const response = await enrollFace(employee.id, {
        uri: picked.assets[0].uri,
        name: "enroll.jpg",
        type: "image/jpeg",
      });
      setEnrollMessage(`Enrolled ${response.employee_name}.`);
      load();
    } catch (err) {
      setEnrollMessage(err instanceof ApiRequestError ? err.message : "Enrollment failed.");
    } finally {
      setEnrolling(false);
    }
  }

  if (error) {
    return (
      <ThemedView style={styles.container} animated>
        <SafeAreaView style={styles.center}>
          <ThemedText themeColor="destructive">{error}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!employee) {
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
            {employee.employee_name}
          </ThemedText>
          <ThemedText themeColor="mutedForeground">
            {employee.employee_code} · {employee.status}
          </ThemedText>

          <View
            style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Employment
            </ThemedText>
            <Field label="Designation" value={employee.designation} />
            <Field label="Department" value={employee.department} />
            <Field label="Location" value={employee.location} />
            <Field label="Date of joining" value={employee.date_of_joining} />
            <Field label="Skill category" value={employee.skill_category} />
          </View>

          <View
            style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Personal & statutory
            </ThemedText>
            <Field label="Phone" value={employee.phone} />
            <Field label="Gender" value={employee.age_gender_display} />
            <Field label="PF number" value={employee.pf_number} />
            <Field label="UAN" value={employee.uan} />
            <Field label="ESIC number" value={employee.esic_number} />
          </View>

          <View
            style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Face check-in
            </ThemedText>
            <ThemedText type="small" themeColor="mutedForeground" style={styles.enrollStatus}>
              {employee.enrolled_at
                ? `Enrolled ${new Date(employee.enrolled_at).toLocaleDateString()}`
                : "Not enrolled yet"}
            </ThemedText>
            <AnimatedPressable
              onPress={handleEnroll}
              disabled={enrolling}
              style={[
                styles.enrollButton,
                { backgroundColor: theme.primary, opacity: enrolling ? 0.6 : 1 },
              ]}
            >
              {enrolling ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                  {employee.enrolled_at ? "Re-enroll face" : "Enroll face"}
                </ThemedText>
              )}
            </AnimatedPressable>
            {enrollMessage ? (
              <ThemedText type="small" themeColor="mutedForeground" style={styles.enrollMessage}>
                {enrollMessage}
              </ThemedText>
            ) : null}
          </View>
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
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginBottom: Spacing.one,
  },
  field: {
    gap: 1,
  },
  enrollStatus: {
    marginBottom: Spacing.one,
  },
  enrollButton: {
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  enrollMessage: {
    marginTop: Spacing.one,
  },
});
