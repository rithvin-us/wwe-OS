import { ApiRequestError } from "@bop/sdk";
import type { TimelineEntry, TimelineModule } from "@bop/shared-types";
import { TIMELINE_MODULES } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { activityLabel, getTimeline, timelineHref } from "@/lib/audit";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";

const MODULE_LABELS: Record<TimelineModule, string> = {
  purchase: "Purchases",
  hr: "HR",
  documents: "Documents",
  assets: "Delivery Challans",
  contracts: "Contracts",
  inventory: "Inventory",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function EntryRow({ entry }: { entry: TimelineEntry }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const href = timelineHref(entry);
  const changeEntries = Object.entries(entry.changes ?? {});

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <AnimatedPressable onPress={() => setExpanded((e) => !e)} style={styles.rowHeader}>
        <View style={styles.rowMain}>
          <ThemedText type="smallBold">{activityLabel(entry)}</ThemedText>
          <ThemedText type="small" themeColor="mutedForeground">
            {MODULE_LABELS[entry.module as TimelineModule] ?? entry.module} ·{" "}
            {relativeTime(entry.created_at)}
          </ThemedText>
        </View>
      </AnimatedPressable>

      {expanded ? (
        <View style={styles.rowExpanded}>
          {changeEntries.length === 0 ? (
            <ThemedText type="small" themeColor="mutedForeground">
              No field-level details recorded for this event.
            </ThemedText>
          ) : (
            changeEntries.map(([key, value]) => (
              <View key={key} style={styles.changeRow}>
                <ThemedText type="small" themeColor="mutedForeground">
                  {key}
                </ThemedText>
                <ThemedText type="small">{String(value)}</ThemedText>
              </View>
            ))
          )}
          {href ? (
            <AnimatedPressable onPress={() => router.push(href as never)}>
              <ThemedText type="small" themeColor="mutedForeground" style={styles.openLink}>
                Open in {MODULE_LABELS[entry.module as TimelineModule] ?? entry.module} ›
              </ThemedText>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function TimelineScreen() {
  const theme = useTheme();
  const [moduleFilter, setModuleFilter] = useState<TimelineModule | null>(null);
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (module: TimelineModule | null) => {
    try {
      setError(null);
      setEntries(await getTimeline(module ? { module } : {}));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load activity.");
    }
  }, []);

  useEffect(() => {
    setEntries(null);
    load(moduleFilter);
  }, [moduleFilter, load]);

  const filtered = entries?.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      activityLabel(e).toLowerCase().includes(q) || (e.vendorName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Business Timeline
          </ThemedText>
          <ThemedText type="small" themeColor="mutedForeground">
            Everything that happened across the company, in one feed.
          </ThemedText>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search activity"
          placeholderTextColor={theme.mutedForeground}
          style={[
            styles.search,
            { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
          ]}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <AnimatedPressable
            onPress={() => setModuleFilter(null)}
            style={[
              styles.chip,
              {
                borderColor: moduleFilter === null ? theme.primary : theme.border,
                backgroundColor: moduleFilter === null ? `${theme.primary}18` : theme.card,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={
                moduleFilter === null ? { color: theme.primary, fontWeight: "600" } : undefined
              }
            >
              All
            </ThemedText>
          </AnimatedPressable>
          {TIMELINE_MODULES.map((m) => (
            <AnimatedPressable
              key={m}
              onPress={() => setModuleFilter(m)}
              style={[
                styles.chip,
                {
                  borderColor: moduleFilter === m ? theme.primary : theme.border,
                  backgroundColor: moduleFilter === m ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={moduleFilter === m ? { color: theme.primary, fontWeight: "600" } : undefined}
              >
                {MODULE_LABELS[m]}
              </ThemedText>
            </AnimatedPressable>
          ))}
        </ScrollView>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : entries === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : filtered && filtered.length === 0 ? (
          <ThemedText themeColor="mutedForeground" style={styles.message}>
            Nothing here yet.
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filtered?.map((entry, index) => (
              <Animated.View key={entry.id} entering={listItemEntrance(index)}>
                <EntryRow entry={entry} />
              </Animated.View>
            ))}
          </ScrollView>
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
    gap: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  search: {
    height: 44,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  rowHeader: {
    padding: Spacing.three,
  },
  rowMain: {
    gap: 2,
  },
  rowExpanded: {
    padding: Spacing.three,
    paddingTop: 0,
    gap: Spacing.one,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  openLink: {
    marginTop: Spacing.one,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: "center",
  },
});
