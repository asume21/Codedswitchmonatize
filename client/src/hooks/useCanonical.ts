import { useEffect } from "react";
import { useLocation } from "wouter";

const BASE = "https://www.codedswitch.com";

/** Pages that require authentication — tell Google not to index them */
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
  "/organism",
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
