declare const __GOOGLE_API_KEY__: string | undefined;
declare const google: any;

declare global {
  interface Window {
    initGoogleMaps?: () => void;
    google?: typeof google;
  }
}

export {};

