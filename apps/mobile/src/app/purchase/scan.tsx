import { ApiRequestError } from "@bop/sdk";
import type { PurchaseBill } from "@bop/shared-types";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatValue } from "@/config/dashboard";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { uploadBill } from "@/lib/purchase";

type Phase = "camera" | "submitting" | "result";

function errorMessage(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "Couldn't read that bill. Try again.";
}

/**
 * "Scan a bill" — the Purchase counterpart to HR's photo check-in. Back
 * camera (it's a document, not a selfie) or photo library, uploaded to the
 * JWT-authenticated `/bills/upload/` endpoint added this session.
 */
export default function ScanBillScreen() {
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("camera");
  const [result, setResult] = useState<PurchaseBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(uri: string) {
    setPhase("submitting");
    setError(null);
    try {
      const bill = await uploadBill({ uri, name: "bill.jpg", type: "image/jpeg" });
      setResult(bill);
      setPhase("result");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("result");
    }
  }

  async function capture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
    if (photo) await submit(photo.uri);
  }

  async function pickFromLibrary() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    await submit(picked.assets[0].uri);
  }

  function reset() {
    setResult(null);
    setError(null);
    setPhase("camera");
  }

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ThemedText type="subtitle" style={styles.centerTitle}>
            Camera access needed
          </ThemedText>
          <ThemedText themeColor="mutedForeground" style={styles.centerBody}>
            Scan a paper bill to digitize it automatically — vendor, GSTIN, and totals extracted by
            AI.
          </ThemedText>
          <Pressable
            onPress={requestPermission}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              Grant camera access
            </ThemedText>
          </Pressable>
          <Pressable onPress={pickFromLibrary} style={styles.linkButton}>
            <ThemedText type="small" themeColor="mutedForeground">
              Or choose a photo instead
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        {phase === "result" ? (
          <View style={styles.center}>
            {error ? (
              <>
                <ThemedText type="subtitle" themeColor="destructive" style={styles.centerTitle}>
                  Couldn't digitize this bill
                </ThemedText>
                <ThemedText themeColor="mutedForeground" style={styles.centerBody}>
                  {error}
                </ThemedText>
              </>
            ) : result ? (
              <>
                <ThemedText
                  type="subtitle"
                  themeColor={result.status === "processed" ? "success" : "warning"}
                  style={styles.centerTitle}
                >
                  {result.status === "processed" ? "Bill digitized" : "Needs a quick check"}
                </ThemedText>
                <ThemedText type="title" style={styles.resultVendor}>
                  {result.seller_name}
                </ThemedText>
                <ThemedText themeColor="mutedForeground">
                  {formatValue(Number(result.total_rate), "currency")}
                  {result.invoice_number ? ` · ${result.invoice_number}` : ""}
                </ThemedText>
                <ThemedText type="small" themeColor="mutedForeground" style={styles.confidence}>
                  {Math.round(Number(result.confidence_score) * 100)}% OCR confidence
                </ThemedText>
                <Pressable
                  onPress={() => router.replace(`/purchase/bills/${result.id}` as never)}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.primary, marginTop: Spacing.three },
                  ]}
                >
                  <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                    Review & correct
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={reset} style={styles.linkButton}>
              <ThemedText type="small" themeColor="mutedForeground">
                Scan another
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.controlsRow}>
              <Pressable
                onPress={pickFromLibrary}
                style={[styles.libraryButton, { borderColor: theme.card }]}
              >
                <ThemedText type="small" style={{ color: theme.card }}>
                  Library
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={capture}
                disabled={phase === "submitting"}
                style={[styles.captureButton, { borderColor: theme.card }]}
              >
                {phase === "submitting" ? (
                  <ActivityIndicator color={theme.card} />
                ) : (
                  <View style={[styles.captureButtonInner, { backgroundColor: theme.card }]} />
                )}
              </Pressable>
              <View style={styles.libraryButtonSpacer} />
            </View>
          </>
        )}
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
    paddingHorizontal: Spacing.four,
  },
  camera: {
    flex: 1,
  },
  controlsRow: {
    position: "absolute",
    bottom: Spacing.five,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.five,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  libraryButton: {
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryButtonSpacer: {
    width: 72,
  },
  centerTitle: {
    textAlign: "center",
    marginBottom: Spacing.two,
  },
  centerBody: {
    textAlign: "center",
    marginBottom: Spacing.four,
  },
  resultVendor: {
    fontSize: 24,
    marginBottom: Spacing.one,
  },
  confidence: {
    marginTop: Spacing.one,
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  linkButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
