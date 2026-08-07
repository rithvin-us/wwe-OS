import { ApiRequestError } from "@bop/sdk";
import type { BillingCustomer } from "@bop/shared-types";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import { deleteCustomer, getBillingCustomers, saveCustomer } from "@/lib/finance";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

function emptyForm() {
  return { name: "", address: "", facility: "", gstin: "", state: "", is_sez: false };
}

function CustomerRow({
  customer,
  onDelete,
}: {
  customer: BillingCustomer;
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{customer.name}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {customer.gstin || "No GSTIN"} · {customer.is_sez ? "SEZ (IGST)" : "CGST + SGST"}
        </ThemedText>
        {customer.address ? (
          <ThemedText type="small" themeColor="mutedForeground">
            {customer.address}
          </ThemedText>
        ) : null}
      </View>
      <AnimatedPressable
        onPress={() =>
          Alert.alert("Delete this customer?", customer.name, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(customer.id) },
          ])
        }
      >
        <ThemedText type="small" themeColor="destructive">
          Delete
        </ThemedText>
      </AnimatedPressable>
    </View>
  );
}

export default function CustomersScreen() {
  const theme = useTheme();
  const [customers, setCustomers] = useState<BillingCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCustomers(await getBillingCustomers());
    } catch (err) {
      setError(errorMessage(err, "Couldn't load customers."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveCustomer(form);
      setForm(emptyForm());
      setShowForm(false);
      load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save this customer."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCustomer(id);
      load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete this customer."));
    }
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Customers
          </ThemedText>
          <AnimatedPressable
            onPress={() => setShowForm((s) => !s)}
            style={[styles.newButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              {showForm ? "Close" : "Add"}
            </ThemedText>
          </AnimatedPressable>
        </View>

        {showForm ? (
          <View style={styles.form}>
            <TextInput
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder="Customer / site name"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.input,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <TextInput
              value={form.address}
              onChangeText={(t) => setForm((f) => ({ ...f, address: t }))}
              placeholder="Address"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.input,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <TextInput
              value={form.facility}
              onChangeText={(t) => setForm((f) => ({ ...f, facility: t }))}
              placeholder="Facility"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.input,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <TextInput
              value={form.gstin}
              onChangeText={(t) => setForm((f) => ({ ...f, gstin: t }))}
              placeholder="GSTIN"
              autoCapitalize="characters"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.input,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <TextInput
              value={form.state}
              onChangeText={(t) => setForm((f) => ({ ...f, state: t }))}
              placeholder="State"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.input,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <View style={styles.sezRow}>
              <View style={styles.sezText}>
                <ThemedText type="small">SEZ site</ThemedText>
                <ThemedText type="small" themeColor="mutedForeground">
                  Invoices for an SEZ site bill under IGST. Everything else bills under CGST + SGST.
                </ThemedText>
              </View>
              <Switch
                value={form.is_sez}
                onValueChange={(v) => setForm((f) => ({ ...f, is_sez: v }))}
                trackColor={{ true: theme.primary }}
              />
            </View>
            <AnimatedPressable
              onPress={handleSave}
              disabled={!form.name.trim() || saving}
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary, opacity: !form.name.trim() || saving ? 0.5 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                  Save customer
                </ThemedText>
              )}
            </AnimatedPressable>
          </View>
        ) : null}

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {customers === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={listItemEntrance(index)}>
                <CustomerRow customer={item} onDelete={handleDelete} />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  newButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  sezRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  sezText: {
    flex: 1,
    gap: 2,
  },
  saveButton: {
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: Spacing.three,
    textAlign: "center",
  },
});
