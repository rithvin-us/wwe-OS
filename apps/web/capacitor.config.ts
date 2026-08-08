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
  plugins: {
    SplashScreen: {
      // Held open until the app shell explicitly hides it (see app-shell.tsx)
      // so the fade never happens over a blank WebView mid-load.
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
