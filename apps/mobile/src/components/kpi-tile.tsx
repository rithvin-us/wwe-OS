import { StyleSheet, View } from "react-native";

import { formatValue, type Kpi } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { ThemedText } from "./themed-text";

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const theme = useTheme();
  const up = (kpi.deltaPct ?? 0) >= 0;
  const hasValue = kpi.value !== null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="mutedForeground" style={styles.label}>
        {kpi.label.toUpperCase()}
      </ThemedText>
      <ThemedText type="title" style={styles.value}>
        {hasValue ? formatValue(kpi.value, kpi.format) : "—"}
      </ThemedText>
      {kpi.deltaPct !== null ? (
        <View
          style={[
            styles.deltaBadge,
            { backgroundColor: up ? `${theme.success}22` : `${theme.destructive}22` },
          ]}
        >
          <ThemedText
            type="small"
            style={[styles.deltaText, { color: up ? theme.success : theme.destructive }]}
          >
            {up ? "▲" : "▼"} {Math.abs(kpi.deltaPct)}%
          </ThemedText>
        </View>
      ) : null}
      <ThemedText type="small" themeColor="mutedForeground" style={styles.source}>
        {kpi.status === "error" ? `Couldn't load just now · ${kpi.source}` : kpi.source}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.half,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 22,
    lineHeight: 28,
  },
  deltaBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "700",
  },
  source: {
    fontSize: 11,
  },
});
