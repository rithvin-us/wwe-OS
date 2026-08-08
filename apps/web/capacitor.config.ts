import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.wweos.web",
  appName: "WWE OS Web",
  webDir: "public",
  server: {
    url: "https://web-vert-six-63.vercel.app",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
