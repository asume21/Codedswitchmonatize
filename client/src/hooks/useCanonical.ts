import { useEffect } from "react";
import { useLocation } from "wouter";

const BASE = "https://www.codedswitch.com";

// Homepage defaults from index.html, captured on first run so unmapped routes
// (and returning to "/") restore the rich original title/description.
let DEFAULT_TITLE: string | null = null;
let DEFAULT_DESCRIPTION = "";

/**
 * Pages that require authentication — tell Google not to index them.
 *
 * Exact-match only (Set.has), so "/developer" here does NOT cover the public
 * "/developers" funnel. Keep it that way.
 *
 * "/organism" is deliberately absent: it is the public, no-login guest demo and
 * our strongest search landing page. Anything listed here must ALSO stay out of
 * robots.txt's Disallow list — a blocked page is never fetched, so Google never
 * sees the noindex below and the tag is silently useless.
 */
const NO_INDEX_PATHS = new Set([
  "/dashboard",
  "/settings",
  "/billing",
  "/buy-credits",
  "/credits",
  "/credits/success",
  "/credits/cancel",
  "/profile",
  "/developer",
]);

/**
 * Per-route <title> and <meta name="description">.
 *
 * WHY: this is a client-rendered SPA — every route serves the SAME index.html,
 * so without this map Google sees one identical title/description across
 * /organism, /pricing, /developers, /blog, … and files the weaker pages under
 * "Crawled - currently not indexed" (GSC 2026-07: 8 pages stuck there).
 * Googlebot executes JS, so a title we set at runtime still counts for indexing.
 *
 * Keep keys in sync with the public routes in the /sitemap.xml route
 * (server/routes.ts) and the exact-match paths in client/src/App.tsx.
 * The homepage ("/") keeps the rich default already in index.html — omit it so
 * we never blank out a good tag on an unmapped route.
 *
 * Titles: aim ≤60 chars. Descriptions: aim ~150-160 chars, unique per page.
 */
const PAGE_META: Record<string, { title: string; description: string }> = {
  "/organism": {
    title: "AI Music Organism — Live Beat Demo | CodedSwitch",
    description:
      "Play the CodedSwitch AI Organism free, no login. A living band that builds beats, melodies, and basslines in real time as you perform. Try the guest demo.",
  },
  "/pricing": {
    title: "Pricing & Plans | CodedSwitch AI Music Studio",
    description:
      "Simple credit-based pricing for CodedSwitch. Start free, then pay only for the AI music generation you use — beats, stems, vocals, and full songs. Compare plans.",
  },
  "/developers": {
    title: "Developers — Music & Audio API | CodedSwitch",
    description:
      "Build with the CodedSwitch music API: generate beats, melodies, stems, and vocals programmatically. Docs, endpoints, and credits for developers.",
  },
  "/blog": {
    title: "Blog — AI Music Production Tips | CodedSwitch",
    description:
      "Guides, tutorials, and updates on AI music production, beat making, mixing, and the CodedSwitch studio. Learn to make better music with AI.",
  },
  "/signup": {
    title: "Sign Up Free | CodedSwitch AI Music Studio",
    description:
      "Create a free CodedSwitch account and start making studio-quality beats, melodies, and full songs with AI. No credit card required to begin.",
  },
  "/login": {
    title: "Log In | CodedSwitch AI Music Studio",
    description:
      "Log in to CodedSwitch to access your AI music studio, saved projects, beats, and credits.",
  },
  "/sitemap": {
    title: "Site Map | CodedSwitch",
    description:
      "Browse every public page on CodedSwitch — the AI music studio, live Organism demo, pricing, developer API, and blog.",
  },
};

/**
 * Keeps <link rel="canonical"> and <meta name="robots"> in sync with the
 * current route.  Runs on every navigation.
 */
export function useCanonical() {
  const [location] = useLocation();

  useEffect(() => {
    // ── canonical ──
    const canonical = `${BASE}${location === "/" ? "" : location}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (link) {
      link.href = canonical;
    } else {
      link = document.createElement("link");
      link.rel = "canonical";
      link.href = canonical;
      document.head.appendChild(link);
    }

    // ── og:url ──
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = canonical;

    // ── per-route <title> + description ──
    // Unmapped routes fall back to the rich homepage defaults in index.html,
    // captured once on first run so navigating away and back restores them.
    if (DEFAULT_TITLE === null) {
      DEFAULT_TITLE = document.title;
      DEFAULT_DESCRIPTION =
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
    }
    const meta = PAGE_META[location];
    const title = meta?.title ?? DEFAULT_TITLE;
    const description = meta?.description ?? DEFAULT_DESCRIPTION;

    if (title) document.title = title;

    let desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.name = "description";
      document.head.appendChild(desc);
    }
    desc.content = description;

    // Keep the social-share tags aligned with the page's real title/description.
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle && title) ogTitle.content = title;
    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = description;

    // ── robots noindex for auth-gated pages ──
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (NO_INDEX_PATHS.has(location)) {
      if (robots) {
        robots.content = "noindex, nofollow";
      } else {
        robots = document.createElement("meta");
        robots.name = "robots";
        robots.content = "noindex, nofollow";
        document.head.appendChild(robots);
      }
    } else if (robots) {
      robots.content = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
    }
  }, [location]);
}
