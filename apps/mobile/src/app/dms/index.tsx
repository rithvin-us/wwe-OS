import { ApiRequestError } from "@bop/sdk";
import type { DocumentRecord, DocumentStatus } from "@bop/shared-types";
import { formatFileSize } from "@bop/shared-types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listItemEntrance } from "@/lib/motion";
import { getDocuments } from "@/lib/dms";

const FILTERS: { label: string; value: DocumentStatus | undefined }[] = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: undefined },
];

function DocumentRow({ doc }: { doc: DocumentRecord }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={() => router.push(`/dms/${doc.id}` as never)}
      style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{doc.title}</ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          {doc.category_label} · {formatFileSize(doc.file_size)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor={doc.status === "active" ? "success" : "mutedForeground"}>
        {doc.status_label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function DocumentsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<DocumentStatus | undefined>("active");
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: DocumentStatus | undefined) => {
    try {
      setError(null);
      setDocuments(await getDocuments(status ? { status } : {}));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load documents.");
    }
  }, []);

  useEffect(() => {
    setDocuments(null);
    load(filter);
  }, [filter, load]);

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Documents
          </ThemedText>
          <AnimatedPressable
            onPress={() => router.push("/dms/upload")}
            style={[styles.uploadButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              Upload
            </ThemedText>
          </AnimatedPressable>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <AnimatedPressable
              key={f.label}
              onPress={() => setFilter(f.value)}
              style={[
                styles.filterChip,
                {
                  borderColor: filter === f.value ? theme.primary : theme.border,
                  backgroundColor: filter === f.value ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={filter === f.value ? { color: theme.primary, fontWeight: "600" } : undefined}
              >
                {f.label}
              </ThemedText>
            </AnimatedPressable>
          ))}
        </View>

        {error ? (
          <ThemedText themeColor="destructive" style={styles.message}>
            {error}
          </ThemedText>
        ) : documents === null ? (
          <ActivityIndicator color={theme.primary} style={styles.message} />
        ) : documents.length === 0 ? (
          <ThemedText themeColor="mutedForeground" style={styles.message}>
            No documents here yet.
          </ThemedText>
        ) : (
          <FlatList
            data={documents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={listItemEntrance(index)}>
                <DocumentRow doc={item} />
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
  uploadButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
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
