import { relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

/**
 * Production entry: the API under /api plus the built web app, on one port. `webDist` is
 * the Vite build output; null when it hasn't been built yet.
 */
export function createRootApp(api: Hono, webDist: string | null) {
  const app = new Hono();

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Recharts positions tooltips and labels with inline style attributes.
        styleSrc: ["'self'", "'unsafe-inline'"],
        // The Garmin profile photo comes from Garmin's CDN.
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );

  app.route("/", api);

  if (!webDist) {
    app.get("*", (c) =>
      c.text("O app ainda não foi compilado. Rode `npm run build` (ou só `npm start`).", 503),
    );
    return app;
  }
  // serveStatic resolves `root` against the working directory.
  const root = relative(process.cwd(), webDist).replaceAll("\\", "/") || ".";
  app.use("/*", serveStatic({ root }));
  return app;
}
