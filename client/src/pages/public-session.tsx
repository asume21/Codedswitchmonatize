import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Radio, Share2, Copy, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public page for one shared Organism session (/p/:id).
 *
 * Sharing a session used to return "/social-hub" — there was no link you could
 * send someone to hear *your* freestyle (product review S3). This page plays
 * the session, shows its caption, and invites the listener to jam themselves.
 */
interface PublicSession {
  id: string;
  title: string;
  content: string;
  mediaUrl: string | null;
  username: string;
  createdAt: string;
}

function captionOf(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed?.caption === "string" ? parsed.caption : "";
  } catch {
    return content || "";
  }
}

export default function PublicSessionPage() {
  const [, params] = useRoute("/p/:id");
  const [session, setSession] = useState<PublicSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/social/session/${encodeURIComponent(params.id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setSession((await r.json()).session);
        setState("ready");
      })
      .catch(() => setState("missing"));
  }, [params?.id]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: session?.title, url: shareUrl }); return; } catch { /* cancelled */ }
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-500/20 bg-black/60 p-6 space-y-5">
        {state === "loading" && <p className="text-cyan-300/60 text-sm">Loading session…</p>}
        {state === "missing" && (
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-cyan-100">This session isn't available</h1>
            <p className="text-sm text-cyan-400/60">It may have been removed. You can start your own jam below.</p>
          </div>
        )}
        {state === "ready" && session && (
          <>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-400">
              <Radio className="h-4 w-4" /> Organism session
            </div>
            <div>
              <h1 className="text-2xl font-black text-cyan-50">{session.title}</h1>
              <p className="mt-1 text-sm text-cyan-400/70">
                by {session.username} · {new Date(session.createdAt).toLocaleDateString()}
              </p>
            </div>
            {captionOf(session.content) && (
              <p className="text-cyan-100/90 whitespace-pre-wrap">{captionOf(session.content)}</p>
            )}
            {session.mediaUrl ? (
              <audio controls src={session.mediaUrl} className="w-full" />
            ) : (
              <p className="text-sm text-cyan-500/50">No audio was attached to this session.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={share} className="gap-1 border-cyan-500/30 text-cyan-200">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1 border-cyan-500/30 text-cyan-200">
                <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </>
        )}
        <div className="border-t border-cyan-500/15 pt-4">
          <Link href="/organism">
            <Button className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold">
              <Mic className="h-4 w-4" /> Jam with the Organism — free
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
