import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import cors from "cors";
import { registerRoutes } from "./routes";
import { getTwilioClient, getTwilioFromPhoneNumber } from "./lib/twilio-client";
import { setupVite, serveStatic, log } from "./vite";
import { processPendingSmsFallbacks, initCronDependencies } from "./cron-jobs";

const MemoryStore = createMemoryStore(session);

const app = express();

app.use(cors({ 
  origin: true, // Allow any origin
  credentials: true, // Allow cookies/sessions
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Contact-ID",
    "X-User-ID",
    "Accept",
    "Origin",
  ],
  exposedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Contact-ID",
    "X-User-ID",
  ]
}));


// Parse JSON for all routes EXCEPT Stripe webhook (which needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false }));

// Session configuration
// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    }),
    cookie: {
      secure: false, // Allow cookies to work over HTTP
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax", // Allow cookies to be sent in cross-site requests
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, () => {
    log(`serving on port ${port}`);
    
    // Initialize cron job dependencies
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
    initCronDependencies(getTwilioClient, getTwilioFromPhoneNumber, baseUrl);
    
    // Start SMS fallback cron job - runs every 15 seconds
    const SMS_FALLBACK_INTERVAL = 15000; // 15 seconds
    setInterval(async () => {
      try {
        await processPendingSmsFallbacks();
      } catch (error) {
        console.error("[CronScheduler] SMS fallback job error:", error);
      }
    }, SMS_FALLBACK_INTERVAL);
    
    log(`SMS fallback cron job started (interval: ${SMS_FALLBACK_INTERVAL / 1000}s)`);
  });
})();
