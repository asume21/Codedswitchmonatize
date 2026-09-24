// Extracted from server/routes.ts — order and behavior preserved.
import express, { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { LOCAL_OBJECTS_DIR, sendError } from "./common";
import type { IStorage } from "../storage";

export function createPublicInfoRoutes(storage: IStorage) {
  const router = Router();
  router.get("/sitemap.xml", (req: Request, res: Response) => {
    const escapeXml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
    const host = req.headers.host || (process.env.APP_URL ? new URL(process.env.APP_URL).host : "localhost");
    const baseUrl = `${proto}://${host}`;
    const now = new Date().toISOString();

    // Only pages a logged-OUT crawler can actually render. Two rules, both learned
    // the hard way (GSC 2026-07-11: 7 indexed vs 33 not indexed):
    //   1. No ProtectedRoute pages. Googlebot hits the login wall, sees no content,
    //      and files the URL under "Crawled - currently not indexed". That is how
    //      /studio, /social-hub, /vulnerability-scanner and /sample-library got here.
    //   2. No redirects. /subscribe 302s to /pricing, which lands the URL in the
    //      "Page with redirect" bucket. List the destination, not the alias.
    // Must also stay in sync with robots.txt Disallow rules.
    const urls: Array<{ loc: string; changefreq?: string; priority?: string }> = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/organism", changefreq: "weekly", priority: "0.9" },
      { loc: "/pricing", changefreq: "monthly", priority: "0.8" },
      { loc: "/developers", changefreq: "weekly", priority: "0.7" },
      { loc: "/blog", changefreq: "weekly", priority: "0.7" },
      { loc: "/signup", changefreq: "monthly", priority: "0.7" },
      { loc: "/login", changefreq: "monthly", priority: "0.6" },
      { loc: "/sitemap", changefreq: "monthly", priority: "0.5" },
    ];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(({ loc, changefreq, priority }) => {
    const fullLoc = escapeXml(`${baseUrl}${loc}`);
    const cf = changefreq ? `<changefreq>${escapeXml(changefreq)}</changefreq>` : "";
    const pr = priority ? `<priority>${escapeXml(priority)}</priority>` : "";
    return `  <url><loc>${fullLoc}</loc><lastmod>${now}</lastmod>${cf}${pr}</url>`;
  })
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(body);
  });


  const waitlistSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
  });

  // Waitlist endpoint
  router.post("/api/waitlist", express.json(), async (req: Request, res: Response) => {
    try {
      const parsed = waitlistSchema.safeParse(req.body || {});
      if (!parsed.success) {
                return sendError(res, 400, "Invalid email.");
      }
      const { email, name } = parsed.data;
      const file = path.join(LOCAL_OBJECTS_DIR, "waitlist.json");
      let list: Array<{ email: string; name?: string; ts: string }> = [];
      try {
        const raw = await fs.promises.readFile(file, "utf8");
        list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }

      const exists = list.some((e) => (e.email || "").toLowerCase() === email.toLowerCase());
      if (!exists) {
        list.push({ email: email.toLowerCase(), name, ts: new Date().toISOString() });
        await fs.promises.writeFile(file, JSON.stringify(list, null, 2), "utf8");
      }
      return res.json({ ok: true, already: exists });
    } catch (err: any) {
            return sendError(res, 500, err?.message || "Failed to join waitlist");
    }
  });

  // Subscription status endpoint (public - returns free tier for guests)
  router.get("/api/subscription-status", async (req: Request, res: Response) => {
    try {
      // If no userId, return free tier status for guests
      if (!req.userId) {
        return res.json({
          hasActiveSubscription: false,
          tier: 'free',
          monthlyUploads: 0,
          monthlyGenerations: 0,
          lastUsageReset: null,
          isAuthenticated: false,
        });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        // User ID in session but user doesn't exist - treat as guest
        return res.json({
          hasActiveSubscription: false,
          tier: 'free',
          monthlyUploads: 0,
          monthlyGenerations: 0,
          lastUsageReset: null,
          isAuthenticated: false,
        });
      }

      const subscriptionStatus = {
        hasActiveSubscription: user.subscriptionTier === 'pro' || user.subscriptionStatus === 'active',
        tier: user.subscriptionTier || 'free',
        monthlyUploads: user.monthlyUploads || 0,
        monthlyGenerations: user.monthlyGenerations || 0,
        lastUsageReset: user.lastUsageReset,
        isAuthenticated: true,
      };

      res.json(subscriptionStatus);
    } catch (err: any) {
      sendError(res, 500, err?.message || "Failed to fetch subscription status");
    }
  });

  return router;
}
