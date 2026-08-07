import { ApiRequestError } from "@bop/sdk";
import type { DeliveryChallan } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import { deleteDC, getDCs, openDCPdf } from "@/lib/assets";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function DCRow({ dc }: { dc: DeliveryChallan }) {
  const theme = useTheme();
  const [busy, setBusy] = useState<"open" | "delete" | null>(null);

  async function handleOpen() {
    setBusy("open");
    try {
      await openDCPdf(dc.id);
    } catch {
      Alert.alert("Couldn't open this file.");
    } finally {
      setBusy(null);
    }
  }

  function handleDelete() {
    Alert.alert("Delete this DC?", dc.dc_number, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await deleteDC(dc.id);
            router.replace("/assets" as never);
          } catch {
            Alert.alert("Couldn't delete this DC.");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{dc.dc_number}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {dc.site?.name ?? "No site"} ·{" "}
          {dc.dc_type === "returnable" ? "Returnable" : "Non-returnable"}
        </ThemedText>
      </View>
      <View style={styles.rowActions}>
        {dc.pdf_url ? (
          <AnimatedPressable onPress={handleOpen} disabled={busy !== null}>
            {busy === "open" ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <ThemedText type="small" themeColor="mutedForeground">
                PDF
              </ThemedText>
            )}
          </AnimatedPressable>
        ) : null}
        <AnimatedPressable onPress={handleDelete} disabled={busy !== null}>
          {busy === "delete" ? (
            <ActivityIndicator size="small" color={theme.destructive} />
          ) : (
            <ThemedText type="small" themeColor="destructive">
              Delete
            </ThemedText>
          )}
        </AnimatedPressable>
      </View>
    </View>
  );
}

export default function DeliveryChallansScreen() {
  const theme = useTheme();
  const [dcs, setDcs] = useState<DeliveryChallan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setDcs(await getDCs());
    } catch (err) {
      setError(errorMessage(err, "Couldn't load delivery challans."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = dcs?.length ?? 0;
  const returnable = dcs?.filter((d) => d.dc_type === "returnable").length ?? 0;
  const thisMonth = dcs?.filter((d) => isThisMonth(d.created_at)).length ?? 0;

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Delivery Challans
          </ThemedText>
          <AnimatedPressable
            onPress={() => router.push("/assets/new")}
            style={[styles.newButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              Generate
            </ThemedText>
          </AnimatedPressable>
        </View>

        {dcs && dcs.length > 0 ? (
          <View style={styles.statGrid}>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                Total
              </ThemedText>
              <ThemedText type="title" style={styles.statValue}>
                {total}
              </ThemedText>
            </View>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                Returnable
              </ThemedText>
              <ThemedText type="title" style={styles.statValue}>
                {returnable} ({Math.round((returnable / total) * 100)}%)
              </ThemedText>
            </View>
            <View
              style={[styles.statTile, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <ThemedText type="small" themeColor="mutedForeground">
                This month
              </ThemedText>
              <ThemedText type="title" style={styles.statValue}>
                {thisMonth}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : dcs === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : dcs.length === 0 ? (
          <ThemedText themeColor="mutedForeground" style={styles.message}>
            No delivery challans yet.
          </ThemedText>
        ) : (
          <FlatList
            data={dcs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={listItemEntrance(index)}>
                <DCRow dc={item} />
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
    fontSize: 22,
    lineHeight: 28,
  },
  newButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statGrid: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  statTile: {
    flex: 1,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    lineHeight: 20,
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
  rowActions: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: "center",
  },
});
