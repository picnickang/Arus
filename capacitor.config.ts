import { CapacitorConfig } from '@capacitor/cli';
import type {} from '@capacitor/app';
import type {} from '@capacitor/filesystem';
import type {} from '@capacitor/network';
import type {} from '@capacitor/status-bar';

const config: CapacitorConfig = {
  appId: 'com.arus.marine',
  appName: 'ARUS Marine',
  webDir: 'dist/public',
  bundledWebRuntime: false,
  
  // Server configuration for development
  // In production iOS builds, remove server.url to use bundled static assets
  server: process.env.CAPACITOR_DEV_SERVER === 'true' ? {
    url: 'http://localhost:5000',
    cleartext: true,
    androidScheme: 'http'
  } : undefined,
  
  ios: {
    contentInset: 'always',
    backgroundColor: '#0369a1',
    scheme: 'ARUS',
    // Allow inline media playback (for videos/audio)
    allowsInlineMediaPlayback: true,
    // Disable link preview
    limitsNavigationsToAppBoundDomains: true,
    // Configure build settings
    buildConfiguration: 'Release'
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0369a1",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      launchAutoHide: true,
      androidSplashResourceName: "splash",
      iosSplashResourceName: "Splash"
    },
    StatusBar: {
      style: "light",
      backgroundColor: "#0369a1",
      overlaysWebView: false
    },
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    }
  }
};

export default config;
