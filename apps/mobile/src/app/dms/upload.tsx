import { ApiRequestError } from "@bop/sdk";
import type { DocumentCategory } from "@bop/shared-types";
import { DOCUMENT_CATEGORIES } from "@bop/shared-types";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { uploadDocument } from "@/lib/dms";
import type { LocalFile } from "@/lib/local-file";

export default function UploadDocumentScreen() {
  const theme = useTheme();
  const [file, setFile] = useState<LocalFile & { size?: number }>();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "image/*",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/octet-stream",
      size: asset.size,
    });
    if (!title) setTitle(asset.name.replace(/\.[^.]+$/, ""));
  }

  function addTag() {
    const trimmed = tagInput.trim().replace(/^,|,$/g, "");
    if (!trimmed) return;
    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  const canSubmit = !!file && title.trim().length > 0 && !uploading;

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument({
        file,
        title: title.trim(),
        category,
        description: description || undefined,
        tags,
      });
      router.replace(`/dms/${doc.id}` as never);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't upload this document.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Upload a document
          </ThemedText>
          <ThemedText type="small" themeColor="mutedForeground">
            The file is stored securely and summarized automatically.
          </ThemedText>

          <AnimatedPressable
            onPress={pickFile}
            style={[styles.dropzone, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            {file ? (
              <>
                <ThemedText type="smallBold">{file.name}</ThemedText>
                {file.size ? (
                  <ThemedText type="small" themeColor="mutedForeground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <>
                <ThemedText type="smallBold">Tap to choose a file</ThemedText>
                <ThemedText type="small" themeColor="mutedForeground">
                  PDF, image, or Word document
                </ThemedText>
              </>
            )}
          </AnimatedPressable>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            TITLE
          </ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Office lease 2026"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            CATEGORY
          </ThemedText>
          <View style={styles.chipRow}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <AnimatedPressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: category === c.value ? theme.primary : theme.border,
                    backgroundColor: category === c.value ? `${theme.primary}18` : theme.card,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={
                    category === c.value ? { color: theme.primary, fontWeight: "600" } : undefined
                  }
                >
                  {c.label}
                </ThemedText>
              </AnimatedPressable>
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            DESCRIPTION (OPTIONAL)
          </ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Optional — a line about what this is"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              styles.textArea,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />

          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            TAGS
          </ThemedText>
          {tags.length > 0 ? (
            <View style={styles.chipRow}>
              {tags.map((tag) => (
                <AnimatedPressable
                  key={tag}
                  onPress={() => removeTag(tag)}
                  style={[
                    styles.chip,
                    { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
                  ]}
                >
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {tag} ×
                  </ThemedText>
                </AnimatedPressable>
              ))}
            </View>
          ) : null}
          <View style={styles.tagInputRow}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              placeholder="Type a tag & press enter"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.input,
                styles.tagInput,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <AnimatedPressable
              onPress={addTag}
              style={[styles.addTagButton, { borderColor: theme.border }]}
            >
              <ThemedText type="small">Add</ThemedText>
            </AnimatedPressable>
          </View>

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <AnimatedPressable
            onPress={handleUpload}
            disabled={!canSubmit}
            style={[
              styles.submitButton,
              { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5 },
            ]}
          >
            {uploading ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Upload document
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
  },
  dropzone: {
    marginTop: Spacing.two,
    padding: Spacing.four,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    gap: 2,
  },
  label: {
    marginTop: Spacing.two,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.two,
    textAlignVertical: "top",
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
  tagInputRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  tagInput: {
    flex: 1,
  },
  addTagButton: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    marginTop: -Spacing.one,
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.three,
  },
});
