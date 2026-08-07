import { ApiRequestError } from "@bop/sdk";
import type {
  AutomationCadence,
  AutomationDestination,
  AutomationRule,
  AutomationSource,
  RuleWriteInput,
} from "@bop/shared-types";
import { STUB_DESTINATIONS } from "@bop/shared-types";
import type { Tag } from "@bop/shared-types";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getRuleSources } from "@/lib/automation";
import { listTags } from "@/lib/tags";

const DESTINATIONS: { value: AutomationDestination; label: string }[] = [
  { value: "downloaded_package", label: "Downloaded package" },
  { value: "generate_report", label: "Generate report" },
  { value: "auditor_folder", label: "Auditor folder" },
  { value: "email", label: "Email (coming soon)" },
  { value: "cloud_storage", label: "Cloud storage (coming soon)" },
];

const CADENCES: AutomationCadence[] = ["once", "daily", "weekly", "monthly"];
const REPORT_FORMATS = ["csv", "xlsx", "pdf", "html"];

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
    <AnimatedPressable
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
    </AnimatedPressable>
  );
}

interface Props {
  initial?: AutomationRule;
  onSubmit: (input: RuleWriteInput) => Promise<void>;
  submitLabel: string;
}

export function AutomationRuleForm({ initial, onSubmit, submitLabel }: Props) {
  const theme = useTheme();
  const [sources, setSources] = useState<AutomationSource[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [destination, setDestination] = useState<AutomationDestination>(
    initial?.destination ?? "downloaded_package",
  );
  const [sourceModules, setSourceModules] = useState<string[]>(initial?.source_modules ?? []);
  const [reportKey, setReportKey] = useState(initial?.report_key ?? "");
  const [exportFormat, setExportFormat] = useState(initial?.export_format || "csv");
  const [requiredTags, setRequiredTags] = useState<string[]>(initial?.required_tags ?? []);
  const [cadence, setCadence] = useState<AutomationCadence>(initial?.cadence ?? "once");
  const [nextRunAt, setNextRunAt] = useState(initial?.next_run_at?.slice(0, 16) ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRuleSources()
      .then(setSources)
      .catch(() => setSources([]));
    listTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  const needsSources = destination !== "generate_report";
  const isStub = STUB_DESTINATIONS.includes(destination);
  const canSubmit =
    name.trim().length > 0 &&
    requiredTags.length > 0 &&
    (!needsSources || sourceModules.length > 0) &&
    (destination !== "generate_report" || reportKey.trim().length > 0) &&
    nextRunAt.trim().length > 0 &&
    !submitting;

  function toggleSource(module: string) {
    setSourceModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module],
    );
  }

  function toggleTag(name_: string) {
    setRequiredTags((prev) =>
      prev.includes(name_) ? prev.filter((t) => t !== name_) : [...prev, name_],
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description || undefined,
        destination,
        source_modules: needsSources ? sourceModules : [],
        report_key: destination === "generate_report" ? reportKey.trim() : undefined,
        export_format: destination === "generate_report" ? exportFormat : undefined,
        required_tags: requiredTags,
        cadence,
        next_run_at: new Date(nextRunAt).toISOString(),
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save this rule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="mutedForeground">
        NAME
      </ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Monthly auditor package"
        placeholderTextColor={theme.mutedForeground}
        style={[
          styles.input,
          { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
        ]}
      />

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        DESCRIPTION (OPTIONAL)
      </ThemedText>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What is this for?"
        placeholderTextColor={theme.mutedForeground}
        style={[
          styles.input,
          { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
        ]}
      />

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        DESTINATION
      </ThemedText>
      <View style={styles.chipRow}>
        {DESTINATIONS.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={destination === d.value}
            onPress={() => setDestination(d.value)}
          />
        ))}
      </View>
      {isStub ? (
        <ThemedText type="small" themeColor="warning">
          This destination can be saved but won't actually run yet — email/cloud delivery isn't
          wired up.
        </ThemedText>
      ) : null}

      {needsSources ? (
        <>
          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            SOURCES
          </ThemedText>
          <View style={styles.chipRow}>
            {sources.map((s) => (
              <Chip
                key={s.module}
                label={s.label}
                selected={sourceModules.includes(s.module)}
                onPress={() => toggleSource(s.module)}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            REPORT KEY
          </ThemedText>
          <TextInput
            value={reportKey}
            onChangeText={setReportKey}
            placeholder="e.g. purchase-bills"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
            ]}
          />
          <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
            FORMAT
          </ThemedText>
          <View style={styles.chipRow}>
            {REPORT_FORMATS.map((f) => (
              <Chip
                key={f}
                label={f.toUpperCase()}
                selected={exportFormat === f}
                onPress={() => setExportFormat(f)}
              />
            ))}
          </View>
        </>
      )}

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        REQUIRED TAGS
      </ThemedText>
      <View style={styles.chipRow}>
        {tags.map((t) => (
          <Chip
            key={t.id}
            label={t.name}
            selected={requiredTags.includes(t.name)}
            onPress={() => toggleTag(t.name)}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="mutedForeground">
        Only tagged records are ever collected — nothing untagged goes into a package.
      </ThemedText>

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        REPEATS
      </ThemedText>
      <View style={styles.chipRow}>
        {CADENCES.map((c) => (
          <Chip
            key={c}
            label={c[0].toUpperCase() + c.slice(1)}
            selected={cadence === c}
            onPress={() => setCadence(c)}
          />
        ))}
      </View>

      <ThemedText type="smallBold" themeColor="mutedForeground" style={styles.label}>
        TRIGGER DATE
      </ThemedText>
      <TextInput
        value={nextRunAt}
        onChangeText={setNextRunAt}
        placeholder="YYYY-MM-DDTHH:MM"
        placeholderTextColor={theme.mutedForeground}
        style={[
          styles.input,
          { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card },
        ]}
      />
      <ThemedText type="small" themeColor="mutedForeground">
        Nothing runs this automatically yet in this deployment — use "Run now" on the rule when you
        want it to actually execute. This date is stored and used if scheduled execution is turned
        on later.
      </ThemedText>

      {error ? (
        <ThemedText themeColor="destructive" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <AnimatedPressable
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
            {submitLabel}
          </ThemedText>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
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
