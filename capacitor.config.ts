import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ionic.scanner',
  appName: 'Ionic Scanner',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
