import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={[styles.mark, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.markText, { color: theme.primaryForeground }]}>
                  W
                </ThemedText>
              </View>
              <View>
                <ThemedText type="title" style={styles.title}>
                  WWE OS Mobile
                </ThemedText>
                <ThemedText type="small" themeColor="mutedForeground">
                  OPERATIONS PLATFORM V1
                </ThemedText>
              </View>
            </View>

            <View
              style={[styles.userBadge, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <ThemedText type="smallBold">{user?.full_name ?? "Lakshmanan"}</ThemedText>
              <ThemedText type="small" themeColor="mutedForeground">
                {user?.email}
              </ThemedText>
            </View>
          </View>

          {/* Quick Stats Grid */}
          <ThemedText type="subtitle" style={styles.sectionHeader}>
            Executive Overview
          </ThemedText>
          <View style={styles.kpiGrid}>
            <View
              style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <ThemedText type="small" themeColor="mutedForeground" style={styles.kpiLabel}>
                REVENUE
              </ThemedText>
              <ThemedText type="title" style={styles.kpiValue}>
                ₹21,50,000
              </ThemedText>
              <ThemedText type="small" style={{ color: "#10b981", fontWeight: "600" }}>
                +14.2% ↑ (Sales & finance)
              </ThemedText>
            </View>

            <View
              style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <ThemedText type="small" themeColor="mutedForeground" style={styles.kpiLabel}>
                EXPENSES
              </ThemedText>
              <ThemedText type="title" style={styles.kpiValue}>
                ₹9,45,000
              </ThemedText>
              <ThemedText type="small" style={{ color: "#f43f5e", fontWeight: "600" }}>
                -3.8% ↓ (Purchases & finance)
              </ThemedText>
            </View>

            <View
              style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <ThemedText type="small" themeColor="mutedForeground" style={styles.kpiLabel}>
                DIGITIZED PURCHASES
              </ThemedText>
              <ThemedText type="title" style={styles.kpiValue}>
                28 Bills
              </ThemedText>
              <ThemedText type="small" style={{ color: "#10b981", fontWeight: "600" }}>
                8.5% OCR Speed (Purchases)
              </ThemedText>
            </View>

            <View
              style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <ThemedText type="small" themeColor="mutedForeground" style={styles.kpiLabel}>
                SERVICE EQUIPMENT
              </ThemedText>
              <ThemedText type="title" style={styles.kpiValue}>
                42 Units
              </ThemedText>
              <ThemedText type="small" style={{ color: "#10b981", fontWeight: "600" }}>
                100% Active (Assets & Machinery)
              </ThemedText>
            </View>
          </View>

          {/* Quick Mobile Actions */}
          <ThemedText type="subtitle" style={styles.sectionHeader}>
            Mobile Operations
          </ThemedText>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Bill Scanner",
                  "Camera OCR ready. Snap paper receipts directly on site.",
                )
              }
              style={[styles.actionButton, { backgroundColor: "#059669" }]}
            >
              <ThemedText style={styles.actionButtonText}>📸 Scan Vendor Bill</ThemedText>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert("Attendance Check-in", "Selfie + GPS location check-in verified.")
              }
              style={[styles.actionButton, { backgroundColor: "#2563eb" }]}
            >
              <ThemedText style={styles.actionButtonText}>⏱️ Selfie Check-in</ThemedText>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => Alert.alert("Invoices", "2 Invoices Raised (KG Hospitals, BGSW).")}
              style={[styles.actionButton, { backgroundColor: "#7c3aed" }]}
            >
              <ThemedText style={styles.actionButtonText}>📑 View Invoices</ThemedText>
            </Pressable>

            <Pressable
              onPress={signOut}
              style={[styles.actionButton, { backgroundColor: "#334155" }]}
            >
              <ThemedText style={styles.actionButtonText}>🚪 Sign Out</ThemedText>
            </Pressable>
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
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    fontSize: 20,
    fontWeight: "800",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  userBadge: {
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    marginTop: Spacing.one,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: Spacing.two,
  },
  kpiGrid: {
    gap: Spacing.three,
  },
  kpiCard: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.one,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
