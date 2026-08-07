import { ApiRequestError } from "@bop/sdk";
import type { CheckInResponse } from "@bop/shared-types";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { checkInFace } from "@/lib/hr";

type Phase = "camera" | "submitting" | "result";

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.details && typeof err.details === "object") {
      const values = Object.values(err.details as Record<string, unknown>).flat();
      const first = values.find((v) => typeof v === "string");
      if (first) return first;
    }
    return err.message;
  }
  return "Something went wrong. Try again.";
}

/**
 * Photo check-in — the flagship mobile HR feature. Selfie only (matches the
 * web kiosk), plus best-effort geolocation the web kiosk doesn't send, since
 * the backend already supports optional geofencing.
 * `POST /api/v1/hr/attendance/checkin/` is public/unauthenticated by design
 * (no login on a shop-floor device) — the request itself needs no token.
 */
export default function CheckInScreen() {
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("camera");
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    if (!cameraRef.current) return;
    setPhase("submitting");
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error("Camera did not return a photo.");

      let location: { lat: number; lon: number; accuracy?: number } | undefined;
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.status === "granted") {
        try {
          const position = await Location.getCurrentPositionAsync({});
          location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined,
          };
        } catch {
          // Best-effort — check-in still works without a location fix.
        }
      }

      const response = await checkInFace(
        { uri: photo.uri, name: "checkin.jpg", type: "image/jpeg" },
        location,
      );
      setResult(response);
      setPhase("result");
    } catch (err) {
      setError(extractErrorMessage(err));
      setPhase("result");
    }
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
          <ThemedText type="subtitle" style={styles.permissionTitle}>
            Camera access needed
          </ThemedText>
          <ThemedText themeColor="mutedForeground" style={styles.permissionBody}>
            Photo check-in matches your face against enrolled employees to log attendance.
          </ThemedText>
          <Pressable
            onPress={requestPermission}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
              Grant camera access
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
                <ThemedText type="subtitle" themeColor="destructive" style={styles.permissionTitle}>
                  Couldn't check in
                </ThemedText>
                <ThemedText themeColor="mutedForeground" style={styles.permissionBody}>
                  {error}
                </ThemedText>
              </>
            ) : result ? (
              <>
                <ThemedText
                  type="subtitle"
                  themeColor={result.decision === "auto_approved" ? "success" : "warning"}
                  style={styles.permissionTitle}
                >
                  {result.decision === "auto_approved" ? "Checked in" : "Flagged for review"}
                </ThemedText>
                <ThemedText type="title" style={styles.resultName}>
                  {result.employee_name ?? "Unknown"}
                </ThemedText>
                <ThemedText themeColor="mutedForeground">
                  {result.employee_code} · {result.direction === "in" ? "Punch in" : "Punch out"} ·{" "}
                  {result.time}
                </ThemedText>
                <ThemedText themeColor="mutedForeground" style={styles.permissionBody}>
                  {result.message}
                </ThemedText>
              </>
            ) : null}
            <Pressable
              onPress={reset}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary, marginTop: Spacing.four },
              ]}
            >
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Check in another
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            <View style={styles.captureRow}>
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
  captureRow: {
    position: "absolute",
    bottom: Spacing.five,
    left: 0,
    right: 0,
    alignItems: "center",
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
  permissionTitle: {
    textAlign: "center",
    marginBottom: Spacing.two,
  },
  permissionBody: {
    textAlign: "center",
    marginBottom: Spacing.four,
  },
  resultName: {
    fontSize: 24,
    marginBottom: Spacing.one,
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
