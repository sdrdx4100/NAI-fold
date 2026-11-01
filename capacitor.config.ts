import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.naifold.app',
  appName: 'NAI Fold',
  webDir: 'dist',
  android: {
    backgroundColor: '#0e0f21',
    allowMixedContent: false,
  },
  plugins: {
    // Use the native HTTP stack for non-streaming requests to avoid CORS issues in the WebView.
    CapacitorHttp: { enabled: false },
  },
};

export default config;
