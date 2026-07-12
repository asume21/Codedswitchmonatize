import { useEffect } from "react";
import { useLocation } from "wouter";

const BASE = "https://www.codedswitch.com";

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
