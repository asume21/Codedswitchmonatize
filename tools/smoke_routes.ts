// Smoke test: mount every router via registerRoutes on a real Express app,
// then enumerate the route stack. Verifies all extracted factories construct
// and register without runtime errors. Run: tsx tools/smoke_routes.ts
import express from "express";

// Stub IStorage — handlers only call storage at request time; registration
// just stores the reference. Proxy returns async no-ops for any method.
const storageStub: any = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === "then") return undefined; // keep it non-thenable
    return async () => undefined;
  },
});

async function main() {
  const { registerRoutes } = await import("../server/" + (process.env.ROUTES_FILE || "routes"));
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  await registerRoutes(app as any, storageStub);

  const stack: any[] = (app as any)._router?.stack ?? (app as any).router?.stack ?? [];
  let mountedRouters = 0;
  let routes = 0;
  const paths: string[] = [];

  const walk = (layers: any[], prefix = "") => {
    for (const layer of layers) {
      if (layer.route) {
        routes++;
        const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
        paths.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === "router" && layer.handle?.stack) {
        mountedRouters++;
        const m = layer.regexp?.source?.match(/\^\\\/(.*?)\\\//);
        const mount = m ? "/" + m[1].replace(/\\\//g, "/") : "";
        walk(layer.handle.stack, prefix + (mount === "/" ? "" : mount));
      }
    }
  };
  walk(stack);

  const fs = await import("fs");
  fs.writeFileSync(process.env.ROUTES_OUT || "route_table_new.json", JSON.stringify(paths.sort(), null, 1));
  console.log(`mounted routers: ${mountedRouters}`);
  console.log(`total routes:    ${routes}`);
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (dupes.length) {
    console.log("duplicate path+method registrations (first-wins, may be intentional):");
    [...new Set(dupes)].forEach(d => console.log("  " + d));
  }
  // Spot-check a sample of extracted routes exist in the stack
  for (const probe of ["/sitemap.xml", "/api/waitlist", "/api/webhooks/stripe",
                       "/api/ai/chat", "/api/music/generate", "/api/jam-sessions",
                       "/api/tracks/mix", "/api/playlists", "/api/audio-analysis/analyze"]) {
    const found = paths.some(p => p.endsWith(probe) || p.includes(probe));
    console.log(`${found ? "OK " : "MISS"} ${probe}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error("REGISTER FAILED:", e); process.exit(1); });
