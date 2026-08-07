import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps apps/web directly instead of a separate hand-built UI —
// server.url points the native WebView at the real Next.js app, so the
// mobile app is always pixel-identical to the web app (same build, same
// design-bible tokens, zero drift). Set CAP_SERVER_URL before `cap sync`
// to point at your LAN dev server (e.g. http://10.10.193.149:3000) or a
// deployed URL (e.g. https://wwe-os.vercel.app) for release builds.
const serverUrl = process.env.CAP_SERVER_URL ?? "http://10.10.193.149:3000";

const config: CapacitorConfig = {
  appId: "com.wweos.app",
  appName: "WWE OS",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
};

export default config;
