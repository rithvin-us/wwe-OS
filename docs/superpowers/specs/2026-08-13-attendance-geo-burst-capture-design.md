# Attendance check-in: geolocation + liveness burst capture

**Status:** Approved. **Scope:** Frontend only.

## Context

`modules/hr/backend/services/checkin.py` already gates every self-service
punch on face match, liveness (`FaceEngine.verify_liveness`, texture +
frame-burst motion/blink analysis) and geofence (`services/geofence.py`,
haversine distance against a configured site). `CheckInRequestSerializer`
(`modules/hr/backend/serializers/checkin.py`) already accepts `frames[]`
(liveness burst, optional), `lat`, `lon`, `accuracy` (all optional).

Neither frontend capture surface — the public kiosk
(`apps/web/src/app/checkin/page.tsx`) or the admin kiosk
(`apps/web/src/app/(platform)/hr/attendance/face-kiosk-dialog.tsx`) — sends
any of these. Both capture exactly one frame and send only `file`. As a
result:

- Liveness degrades to single-frame texture-gate only; the motion/blink path
  in `InsightFaceEngine.verify_liveness` never runs.
- `lat`/`lon` are always null, so `within_site()` is never evaluated with
  real coordinates. `GEOFENCE_ENABLED` defaults `false`
  (`modules/hr/backend/services/face_config.py`), so this is currently inert
  rather than silently rejecting punches — but the feature can't be turned on
  without this fix.

This is pure wiring: no backend change, no new model, no new endpoint field.

## Goal

Both kiosks send a 4-frame liveness burst (~400ms apart, matching the
backend's `MAX_LIVENESS_FRAMES=4`) and a geolocation fix (best-effort) on
every punch, using the fields the backend already accepts.

## Design

### Shared hook — `apps/web/src/hooks/use-face-capture.ts`

Both kiosks duplicate identical `getUserMedia` + canvas-snapshot code today.
Extract a hook so the burst/geo logic exists once:

```ts
function useFaceCapture(videoRef: RefObject<HTMLVideoElement | null>) {
  // returns:
  //   cameraActive: boolean
  //   startCamera(): Promise<void>
  //   stopCamera(): void
  //   captureBurst(): Promise<{ primary: Blob; frames: Blob[] }>
  //   geo: { lat: number; lon: number; accuracy: number } | null
}
```

- `startCamera()` / `stopCamera()` — moved verbatim from both components.
- Geolocation is requested once, on hook mount (alongside camera), via
  `navigator.geolocation.getCurrentPosition` with a 10s timeout and no
  `watchPosition` (a single fix is enough; punches are momentary). Failure
  (denied, timeout, unsupported) leaves `geo: null` — no error state, no
  retry UI. This is a soft signal on the backend already; surfacing a scary
  permission error over it would overstate its importance, especially with
  `GEOFENCE_ENABLED` off by default.
- `captureBurst()` grabs one canvas snapshot immediately, then 3 more at
  ~400ms intervals (`setTimeout` chain, not `setInterval`, so a slow device
  doesn't overlap captures). Returns the first frame as `primary` (unchanged
  semantics — this is still the enrollment/identification frame) and the
  remaining 3 as `frames` (the liveness burst). If a mid-burst snapshot
  fails (e.g. `canvas.toBlob` returns null), it's dropped rather than
  aborting the whole capture — a shorter burst still improves on today's
  single frame.

### Component changes

Both `checkin/page.tsx` and `face-kiosk-dialog.tsx`:

1. Replace local camera state/refs with `useFaceCapture(videoRef)`.
2. `captureAndPunch()` calls `captureBurst()` instead of one `toBlob` call.
3. `FormData` gains `frames` (one `append("frames", blob, ...)` per burst
   frame) and, when `geo` is non-null, `lat`/`lon`/`accuracy`.
4. The "Processing check-in..." / "Matching Face Biometrics..." overlay
   shown during `scanning` covers the burst window too (burst + network call
   both happen inside the existing `scanning` state), so no new loading
   state is needed. Copy changes to prompt the employee to hold still:
   public kiosk overlay text becomes "Hold still..." for the capture beat,
   admin kiosk keeps its existing "Matching Face Biometrics..." (already
   implies stillness).

No change to `apps/web/src/app/api/hr/attendance/checkin/route.ts` (passes
`FormData` through untouched) or `checkInFace()` in
`apps/web/src/app/(platform)/hr/actions.ts` (same).

## Error handling

| Condition                                            | Behavior                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Camera permission denied                             | Unchanged — existing "Enable Camera" / "Retry Camera Access" button.                       |
| Geolocation denied/timeout/unsupported               | Silent. `geo` stays `null`, punch proceeds without `lat`/`lon`. No UI indicator.           |
| Burst capture partially fails                        | Use whatever frames were captured; `frames` may be shorter than 3, never blocks the punch. |
| Burst capture fully fails (no frames beyond primary) | Falls back to today's single-frame behavior — backend already treats `frames` as optional. |

## Testing

No backend tests — backend is untouched and already covered by
`test_checkin.py`, `test_geofence.py`, `test_face_recognition.py`.

Frontend: manual verification only (both kiosks are camera-dependent, no
existing test harness for them). Verify via dev server + browser devtools:

1. Both kiosks prompt for geolocation permission on mount, alongside the
   camera prompt.
2. Network tab shows 4 `frames` entries (or fewer, never zero-effort) plus
   `lat`/`lon`/`accuracy` in the outgoing `FormData` on punch.
3. Denying geolocation still allows a successful punch (no `lat`/`lon` sent,
   no error shown).
4. Existing camera-denied and face-not-recognized flows are unaffected.

## Out of scope

Multi-site geofence config, configurable grace period, shift roster engine,
and offline/IndexedDB sync were identified in the same investigation as
genuinely separate gaps — each needs its own spec, not folded in here.
