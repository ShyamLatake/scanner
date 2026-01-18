import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ionic.scanner',
  appName: 'Ionic Scanner',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: true // Allow HTTP connections if needed
  },
  plugins: {
    CapacitorHttp: {
      enabled: true // Use native HTTP for better mobile compatibility
    },
    Camera: {
      // Camera plugin configuration for face capture
      permissions: ['camera'],
      // Use high quality for face detection
      quality: 90,
      // No editing needed for face capture
      allowEditing: false,
      // Prefer back camera for face capture
      direction: 'REAR'
    }
  }
};

export default config;
