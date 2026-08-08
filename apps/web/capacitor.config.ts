import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.wweos.web",
  appName: "WWE OS Web",
  webDir: "public",
  server: {
    url: "http://10.10.193.180:3000",
    cleartext: true,
  },
};

export default config;
