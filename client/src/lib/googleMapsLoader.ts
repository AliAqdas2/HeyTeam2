const CALLBACK_NAME = "initGoogleMaps";

let googleMapsPromise: Promise<any> | null = null;

type LoadGoogleMapsOptions = {
  apiKey: string;
  libraries?: string[];
  language?: string;
  region?: string;
};

const createScriptUrl = ({ apiKey, libraries = [], language, region }: LoadGoogleMapsOptions) => {
  const params = new URLSearchParams({
    key: apiKey,
    callback: CALLBACK_NAME,
  });

  if (libraries.length) {
    params.set("libraries", libraries.join(","));
  }

  if (language) {
    params.set("language", language);
  }

  if (region) {
    params.set("region", region);
  }

  params.set("loading", "async");
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
};

export const loadGoogleMapsApi = (options: LoadGoogleMapsOptions) => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps API can only be loaded in the browser"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!options.apiKey) {
    return Promise.reject(new Error("Google Maps API key is missing"));
  }

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise<any>((resolve, reject) => {
      const url = createScriptUrl(options);
      let script = document.querySelector<HTMLScriptElement>('script[data-heyteam-google-maps]');

      if (!script) {
        script = document.createElement("script");
        script.async = true;
        script.defer = true;
        script.dataset.heyteamGoogleMaps = "true";
        script.src = url;
        document.head.appendChild(script);
      } else if (script.src !== url) {
        script.src = url;
      }

      script.onerror = (event) => {
        googleMapsPromise = null;
        console.error("Failed to load Google Maps script", event);
        reject(new Error("Failed to load Google Maps script"));
      };

      window.initGoogleMaps = () => {
        if (!window.google?.maps) {
          googleMapsPromise = null;
          reject(new Error("Google Maps failed to initialize"));
          return;
        }

        resolve(window.google.maps);
        window.initGoogleMaps = undefined;
      };
    });
  }

  return googleMapsPromise;
};

