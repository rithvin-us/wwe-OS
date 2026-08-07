import { ApiRequestError } from "@bop/sdk";
import type { Vendor } from "@bop/shared-types";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { createVendor, getVendors, updateVendor } from "@/lib/purchase";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

function VendorRow({ vendor, onToggle }: { vendor: Vendor; onToggle: (v: Vendor) => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    await onToggle(vendor);
    setBusy(false);
  }

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{vendor.name}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {vendor.gst_number || "No GSTIN on file"}
        </ThemedText>
      </View>
      <Pressable onPress={handleToggle} disabled={busy} style={styles.toggle}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.mutedForeground} />
        ) : (
          <ThemedText type="small" themeColor={vendor.is_active ? "success" : "mutedForeground"}>
            {vendor.is_active ? "Active" : "Inactive"}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

export default function VendorsScreen() {
  const theme = useTheme();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [gst, setGst] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setVendors(await getVendors());
    } catch (err) {
      setError(errorMessage(err, "Couldn't load vendors."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createVendor({ name: name.trim(), gst_number: gst.trim() });
      setName("");
      setGst("");
      load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add this vendor."));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(vendor: Vendor) {
    try {
      await updateVendor(vendor.id, { is_active: !vendor.is_active });
      load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't update this vendor."));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Vendors
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Vendor name"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />
          <TextInput
            value={gst}
            onChangeText={setGst}
            placeholder="GSTIN (optional)"
            autoCapitalize="characters"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />
          <Pressable
            onPress={handleCreate}
            disabled={!name.trim() || creating}
            style={[
              styles.addButton,
              { backgroundColor: theme.primary, opacity: !name.trim() || creating ? 0.5 : 1 },
            ]}
          >
            {creating ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Add vendor
              </ThemedText>
            )}
          </Pressable>
        </View>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {vendors === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : (
          <FlatList
            data={vendors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <VendorRow vendor={item} onToggle={handleToggle} />}
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
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
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
  addButton: {
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
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  toggle: {
    minWidth: 64,
    alignItems: "flex-end",
  },
  message: {
    marginTop: Spacing.three,
    textAlign: "center",
  },
});
