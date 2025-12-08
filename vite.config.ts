import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const plugins = [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["attached_assets/pwa/favicon.ico", "attached_assets/pwa/apple-touch-icon.png", "attached_assets/pwa/mask-icon.svg"],
      manifest: {
        name: "HeyTeam - Workforce Coordination",
        short_name: "HeyTeam",
        description: "Lightweight workforce coordination app for managers to message crew, collect availability responses, and manage job schedules",
        theme_color: "#0EA5E9",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/attached_assets/pwa/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/attached_assets/pwa/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        shortcuts: [
          {
            name: "Jobs",
            short_name: "Jobs",
            description: "View and manage jobs",
            url: "/jobs",
            icons: [{ src: "/attached_assets/pwa/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Contacts",
            short_name: "Contacts",
            description: "Manage contacts",
            url: "/contacts",
            icons: [{ src: "/attached_assets/pwa/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Send Message",
            short_name: "Send",
            description: "Send messages to contacts",
            url: "/jobs/new/send",
            icons: [{ src: "/attached_assets/pwa/pwa-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,gif}"],
        // Cache attached_assets directory
        additionalManifestEntries: [
          { url: "/attached_assets/pwa/pwa-192x192.png", revision: null },
          { url: "/attached_assets/pwa/pwa-512x512.png", revision: null },
        ],
        runtimeCaching: [
          {
            urlPattern: /^\/attached_assets\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "attached-assets-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: {
        enabled: false // Disable in development to avoid issues
      }
    }),
  ];

  if (mode !== "production" && env.REPL_ID) {
    const cartographerPlugin = await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer());
    const devBannerPlugin = await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner());
    plugins.push(cartographerPlugin, devBannerPlugin);
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    define: {
      'import.meta.env.VITE_GOOGLE_API_KEY': JSON.stringify(
        env.VITE_GOOGLE_API_KEY || env.GOOGLE_API_KEY || "AIzaSyDIqb3FH1I2KcF-4AcAjvzwVHlzes-JhvQ"
      ),
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
