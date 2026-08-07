import { ApiRequestError } from "@bop/sdk";
import type { DocumentRecord } from "@bop/shared-types";
import { formatFileSize } from "@bop/shared-types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  archiveDocument,
  deleteDocument,
  getDocument,
  openDocument,
  summarizeDocument,
} from "@/lib/dms";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

export default function DocumentDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setDoc(await getDocument(id));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this document."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpen() {
    if (!doc) return;
    setOpening(true);
    try {
      await openDocument(doc.id);
    } catch (err) {
      setError(errorMessage(err, "Couldn't open this document."));
    } finally {
      setOpening(false);
    }
  }

  async function handleSummarize() {
    if (!doc) return;
    setSummarizing(true);
    try {
      setDoc(await summarizeDocument(doc.id));
    } catch (err) {
      setError(errorMessage(err, "Couldn't generate a summary."));
    } finally {
      setSummarizing(false);
    }
  }

  async function handleArchive() {
    if (!doc) return;
    setArchiving(true);
    try {
      setDoc(await archiveDocument(doc.id));
    } catch (err) {
      setError(errorMessage(err, "Couldn't archive this document."));
    } finally {
      setArchiving(false);
    }
  }

  function confirmDelete() {
    if (!doc) return;
    Alert.alert("Delete this document?", "This removes it permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDocument(doc.id);
            router.back();
          } catch (err) {
            setError(errorMessage(err, "Couldn't delete this document."));
          }
        },
      },
    ]);
  }

  if (error && !doc) {
    return (
      <ThemedView style={styles.container} animated>
        <SafeAreaView style={styles.center}>
          <ThemedText themeColor="destructive">{error}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!doc) {
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
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>
              {doc.title}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={doc.status === "active" ? "success" : "mutedForeground"}
            >
              {doc.status_label}
            </ThemedText>
          </View>
          <ThemedText themeColor="mutedForeground">
            {doc.category_label} · {formatFileSize(doc.file_size)}
          </ThemedText>

          {doc.tags.length > 0 ? (
            <View style={styles.chipRow}>
              {doc.tags.map((tag) => (
                <View key={tag.id} style={[styles.tagChip, { borderColor: theme.border }]}>
                  <ThemedText type="small">{tag.name}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {doc.description ? <ThemedText type="small">{doc.description}</ThemedText> : null}

          <View
            style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <View style={styles.summaryHeader}>
              <ThemedText type="smallBold">AI summary</ThemedText>
              <AnimatedPressable onPress={handleSummarize} disabled={summarizing}>
                {summarizing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <ThemedText type="small" themeColor="mutedForeground">
                    {doc.summary_status === "ready" ? "Regenerate" : "Generate"}
                  </ThemedText>
                )}
              </AnimatedPressable>
            </View>
            {doc.summary_status === "ready" && doc.ai_summary ? (
              <ThemedText type="small">{doc.ai_summary}</ThemedText>
            ) : doc.summary_status === "failed" ? (
              <ThemedText type="small" themeColor="destructive">
                Summary generation failed.
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="mutedForeground">
                No summary yet.
              </ThemedText>
            )}
          </View>

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <AnimatedPressable
            onPress={handleOpen}
            disabled={opening}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            {opening ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Download / view
              </ThemedText>
            )}
          </AnimatedPressable>

          <View style={styles.actionRow}>
            {doc.status === "active" ? (
              <AnimatedPressable
                onPress={handleArchive}
                disabled={archiving}
                style={[styles.secondaryButton, { borderColor: theme.border }]}
              >
                {archiving ? (
                  <ActivityIndicator color={theme.foreground} />
                ) : (
                  <ThemedText>Archive</ThemedText>
                )}
              </AnimatedPressable>
            ) : null}
            <AnimatedPressable
              onPress={confirmDelete}
              style={[styles.secondaryButton, { borderColor: theme.destructive }]}
            >
              <ThemedText themeColor="destructive">Delete</ThemedText>
            </AnimatedPressable>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    flexShrink: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  tagChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  error: {
    marginTop: -Spacing.one,
  },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
