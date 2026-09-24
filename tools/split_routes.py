"""Split server/routes.ts inline route clusters into server/routes/*.ts modules.

Mechanical, order-preserving extraction:
- Each region becomes part of a `createXRoutes(storage)` factory returning a
  Router mounted at "/" so handler paths stay verbatim (zero path rewriting).
- Dynamic `import('./x')` inside moved bodies is rewritten to `import('../x')`.
- Shared helpers/limiters/multer/LOCAL_OBJECTS_DIR move to routes/common.ts.
- routes.ts keeps existing mounts; each new router mounts once at the position
  its first region occupied.
"""
import re

SRC = "server/routes.ts"
lines = open(SRC, encoding="utf-8").read().split("\n")
N = len(lines)

# (start, end, dest) — 1-indexed inclusive. Everything not listed stays.
REGIONS = [
    (244, 294, "publicInfo"),       # sitemap
    (333, 356, "fileServing"),      # sample-profiles
    (361, 373, "fileServing"),      # neumann-bass (NEUMANN_DIR const included)
    (428, 660, "aiChat"),           # grok + music-to-code + test-circular
    (661, 705, "musicGeneration"),  # chords
    (706, 748, "fileServing"),      # objects/upload
    (761, 824, "fileServing"),      # LOCAL_ASSETS_DIR/LOOPS_DIR + loops/audio
    (833, 844, "billing"),          # credits/purchase
    (845, 1409, "musicGeneration"), # beats/generate, melody/generate, ai/music/melody
    (1410, 1774, "mixing"),         # mix/generate, ai/mastering
    (1775, 1802, "aiOps"),          # cache-stats + generation-metrics
    (1803, 1967, "mixing"),         # ai/arrangement
    (1968, 2082, "musicGeneration"),# ai/vocal-melody
    (2083, 2321, "stemSeparation"), # stem-separation + status
    (2322, 2557, "musicGeneration"),# chord-progression + generatePattern + generateMelodyNotes
    (2558, 2584, "aiOps"),          # code-to-music
    (2585, 2656, "aiChat"),         # assistant/chat
    (2657, 2761, "securityScan"),   # security/scan
    (2762, 2833, "publicInfo"),     # waitlist + subscription-status
    (2834, 2839, "billing"),        # license + checkout mounts
    (2841, 2955, "playlists"),      # playlists CRUD
    (2956, 2957, "billing"),        # stripe webhook
    (2958, 2995, "musicGeneration"),# generate-music
    (2996, 3016, "aiChat"),         # translate-code
    (3017, 3055, "musicGeneration"),# melodies/generate
    (3056, 3307, "speechCorrection"),# speech-correction x4
    (3308, 3655, "voices"),         # voice library + convert + convert-v2
    (3656, 3922, "audioAnalysis"),  # audio-analysis x8
    (3923, 3953, "library"),        # melodies CRUD
    (3954, 4159, "fileServing"),    # internal uploads put/get + objects/*
    (4160, 4417, "musicGeneration"),# generate-complete
    (4426, 4499, "aiOps"),          # ai-providers x3
    (4500, 4639, "transcription"),  # live-transcribe + transcribe
    (4640, 4677, "library"),        # packs/save
    (4685, 4896, "tracks"),         # tracks CRUD + mix
    (4897, 4993, "jamSessions"),    # jam sessions (env-gated)
]

# Lines pulled out of routes.ts entirely (helpers -> common.ts, dirs -> common.ts,
# zod schemas -> injected into playlists/publicInfo bodies).
REMOVE = [(79, 241), (749, 760), (825, 832)]

FACTORY = {
    "publicInfo": "createPublicInfoRoutes", "fileServing": "createFileServingRoutes",
    "aiChat": "createAiChatRoutes", "musicGeneration": "createMusicGenerationRoutes",
    "mixing": "createMixingRoutes", "stemSeparation": "createStemSeparationRoutes",
    "aiOps": "createAiOpsRoutes", "securityScan": "createSecurityScanRoutes",
    "billing": "createBillingRoutes", "playlists": "createPlaylistRoutes",
    "library": "createLibraryRoutes", "speechCorrection": "createSpeechCorrectionRoutes",
    "voices": "createVoiceRoutes", "audioAnalysis": "createAudioAnalysisRoutes",
    "transcription": "createTranscriptionRoutes", "tracks": "createTrackRoutes",
    "jamSessions": "createJamSessionRoutes",
}
ORDER = list(dict.fromkeys(d for _, _, d in REGIONS))

# identifier -> (module specifier relative to server/routes/, import kind)
# values are (module, kind, usage-regex); usage is checked on comment-stripped text
IMPORT_MAP = {
    "ObjectStorageService": ("../objectStorage", "named"),
    "requireAuth": ("../middleware/auth", "named"),
    "requireSubscription": ("../middleware/auth", "named"),
    "requireFeature": ("../middleware/featureGating", "named"),
    "checkUsageLimit": ("../middleware/featureGating", "named"),
    "requireCredits": ("../middleware/requireCredits", "named"),
    "aiGenerationLimiter": ("../middleware/rateLimiting", "named"),
    "authLimiter": ("../middleware/rateLimiting", "named"),
    "createCheckoutHandler": ("../api/create-checkout", "named"),
    "stripeWebhookHandler": ("../api/webhook", "named"),
    "checkLicenseHandler": ("../api/check-license", "named"),
    "unifiedMusicService": ("../services/unifiedMusicService", "named"),
    "masterAudioFile": ("../services/mastering", "named"),
    "generateMelody": ("../services/grok", "named"),
    "translateCode": ("../services/grok", "named"),
    "getAIClient": ("../services/grok", "named"),
    "callAI": ("../services/aiGateway", "named"),
    "generateSongStructureWithAI": ("../services/ai-structure-grok", "named"),
    "getCreditService": ("../services/credits", "named"),
    "CREDIT_COSTS": ("../services/credits", "named"),
    "analyzeCodeStructure": ("../services/codebeat/analyzeCodeStructure", "named"),
    "composeArrangementFromCode": ("../services/codebeat/composeArrangementFromCode", "named"),
    "validateArrangementPlan": ("../../shared/arrangement", "named"),
    "transcribeAudio": ("../services/transcriptionService", "named"),
    "aiCache": ("../services/aiCache", "named"),
    "withCache": ("../services/aiCache", "named"),
    "getAIGenerationMetricsSnapshot": ("../services/aiRouteMetrics", "named"),
    "recordAIGenerationMetric": ("../services/aiRouteMetrics", "named"),
    "insertPlaylistSchema": ("@shared/schema", "named"),
    "resolveGenerationConstraints": ("@shared/aiProviderCapabilities", "named"),
    "generateSpeechPreview": ("../services/speechCorrection", "named"),
    "createVoiceIdForFile": ("../services/speechCorrection", "named"),
    "storePreview": ("../services/speechCorrection", "named"),
    "getPreview": ("../services/speechCorrection", "named"),
    "applyVoiceConversion": ("../services/speechCorrection", "named"),
    "listVoices": ("../services/voiceLibrary", "named"),
    "getVoice": ("../services/voiceLibrary", "named"),
    "createVoice": ("../services/voiceLibrary", "named"),
    "deleteVoice": ("../services/voiceLibrary", "named"),
    "convertWithVoice": ("../services/voiceLibrary", "named"),
    "checkRvcHealth": ("../services/voiceLibrary", "named"),
    "extractPitch": ("../services/audioAnalysis", "named"),
    "pitchCorrect": ("../services/audioAnalysis", "named"),
    "extractMelody": ("../services/audioAnalysis", "named"),
    "scoreKaraoke": ("../services/audioAnalysis", "named"),
    "detectEmotion": ("../services/audioAnalysis", "named"),
    "classifyAudio": ("../services/audioAnalysis", "named"),
    "checkApiHealth": ("../services/audioAnalysis", "named"),
    "mixPreviewService": ("../services/mixPreview", "named"),
    "MixPreviewRequest": ("../services/mixPreview", "named"),
    "jobManager": ("../services/jobManager", "named"),
    "sanitizePath": ("../utils/security", "named"),
    "sanitizeObjectKey": ("../utils/security", "named"),
    "sanitizeHtml": ("../utils/security", "named"),
    "isValidUUID": ("../utils/security", "named"),
    "resolveAudioPath": ("../utils/security", "named"),
    "classifyLocalAudioPath": ("../services/audioPathResolver", "named"),
    "resolveLocalAudioPath": ("../services/audioPathResolver", "named"),
    "sendError": ("./common", "named"),
    "publicApiLimiter": ("./common", "named"),
    "aiLimiter": ("./common", "named"),
    "uploadLimiter": ("./common", "named"),
    "upload": ("./common", "named"),
    "LOCAL_OBJECTS_DIR": ("./common", "named"),
    "getAudioDuration": ("./common", "named"),
    "polishGeneratedAudio": ("./common", "named"),
    "NOTE_NAMES": ("./common", "named"),
    "estimateDominantPitchClass": ("./common", "named"),
}
# node-lib / default imports use a usage regex (word-boundary alone hits comments)
# name -> (module, kind, usage-regex)
DEFAULT_LIBS = {
    "fs": ("fs", "default", r"\bfs\."),
    "path": ("path", "default", r"\bpath\."),
    "os": ("os", "default", r"\bos\."),
    "crypto": ("crypto", "default", r"\bcrypto\."),
    "ffmpeg": ("fluent-ffmpeg", "default", r"\bffmpeg[.(]"),
    "multer": ("multer", "default", r"\bmulter\("),
    "z": ("zod", "named", r"\bz\."),
}
TYPE_NAMES = {"Request": "express", "Response": "express", "IStorage": "../storage"}

def strip_comments(text):
    out = []
    in_block = False
    for ln in text.split("\n"):
        s = ln.strip()
        if in_block:
            if "*/" in s:
                in_block = False
                s = s.split("*/", 1)[1]
            else:
                continue
        if s.startswith("/*"):
            if "*/" in s:
                s = s.split("*/", 1)[1]
            else:
                in_block = True
                continue
        if s.startswith("//") or s.startswith("*"):
            continue
        out.append(ln)
    return "\n".join(out)

ROUTE_RE = re.compile(r"^(\s*)app\.(get|post|put|delete|patch|use)\(")
DYN_RE = re.compile(r"(\bimport|\brequire)\(\s*([\"'])\./")

def transform(text):
    out = []
    for ln in text.split("\n"):
        ln = ROUTE_RE.sub(r"\1router.\2(", ln)
        ln = DYN_RE.sub(r"\1(\2../", ln)
        out.append(ln)
    return "\n".join(out)

# ---- collect region bodies per file ----
bodies = {f: [] for f in ORDER}
first_region = {}
for s, e, d in REGIONS:
    bodies[d].append("\n".join(lines[s-1:e]))
    first_region.setdefault(d, s)

# per-file injected consts (moved out of the SCHEMAS / helper zones)
bodies["playlists"].insert(0,
    "  const updatePlaylistSchema = insertPlaylistSchema.partial();\n"
    "  const addSongSchema = z.object({ songId: z.string() });\n")
bodies["publicInfo"].insert(1,
    "\n  const waitlistSchema = z.object({\n"
    "    email: z.string().email(),\n"
    "    name: z.string().optional(),\n"
    "  });\n")
bodies["fileServing"].insert(0,
    "  // Use process.cwd() for __dirname equivalent in bundled CJS\n"
    "  const __dirname = process.cwd();\n")

def emit_imports(body_raw):
    body = strip_comments(body_raw)
    used = sorted(n for n in IMPORT_MAP if re.search(rf"\b{re.escape(n)}\b", body))
    for n, (mod, kind, pat) in DEFAULT_LIBS.items():
        if re.search(pat, body):
            used.append(n)
    used_types = sorted(n for n in TYPE_NAMES if re.search(rf"\b{re.escape(n)}\b", body))
    if "IStorage" in used_types:
        used_types.remove("IStorage")  # emitted via signature check instead
    lines_out = []
    ex_default = bool(re.search(r"\bexpress\.", body))
    ex_types = [t for t in ("Request", "Response") if t in used_types]
    spec = "import "
    if ex_default:
        spec += "express, "
    spec += "{ Router" + "".join(f", type {t}" for t in ex_types) + ' } from "express";'
    lines_out.append(spec)
    by_mod = {}
    for n in used:
        mod, kind = IMPORT_MAP.get(n) or DEFAULT_LIBS[n][:2]
        e = by_mod.setdefault(mod, {"named": [], "default": None})
        if kind == "default":
            e["default"] = n
        else:
            e["named"].append(n)
    for mod in sorted(by_mod, key=lambda m: (m.startswith("./"), m)):
        e = by_mod[mod]
        if e["default"] and e["named"]:
            lines_out.append(f'import {e["default"]}, {{ {", ".join(e["named"])} }} from "{mod}";')
        elif e["default"]:
            lines_out.append(f'import {e["default"]} from "{mod}";')
        else:
            lines_out.append(f'import {{ {", ".join(e["named"])} }} from "{mod}";')
    return "\n".join(lines_out)

def write_module(name):
    body = transform("\n".join(bodies[name]))
    uses_storage = bool(re.search(r"\bstorage\b", strip_comments(body)))
    sig = "storage: IStorage" if uses_storage else ""
    imports = emit_imports(body)
    if uses_storage:
        imports += '\nimport type { IStorage } from "../storage";'
    header = (
        "// Extracted from server/routes.ts — order and behavior preserved.\n"
        + imports + "\n\n"
    )
    fn = f"export function {FACTORY[name]}({sig}) {{\n  const router = Router();\n"
    return header + fn + body.rstrip() + "\n\n  return router;\n}\n"

# ---- write route module files ----
for name in ORDER:
    out = write_module(name)
    path_out = f"server/routes/{name}.ts"
    with open(path_out, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"wrote {path_out} ({len(out.splitlines())} lines)")

# ---- write common.ts (helpers block minus __dirname const, plus LOCAL_OBJECTS_DIR) ----
helper_lines = []
for i in range(79, 242):
    if i in (84, 85):   # __dirname comment + const — fileServing declares its own
        continue
    helper_lines.append(lines[i-1])
helper = "\n".join(helper_lines)
helper = re.sub(r"^(const |function |async function )", r"export \1", helper, flags=re.M)

lod = "\n".join(lines[748:760])  # 749-760: LOCAL_OBJECTS_DIR + mkdir
lod = "\n".join(l[2:] if l.startswith("  ") else l for l in lod.split("\n"))
lod = lod.replace("const LOCAL_OBJECTS_DIR", "export const LOCAL_OBJECTS_DIR", 1)

common = (
    "// Shared helpers for the route modules split out of server/routes.ts.\n"
    'import type { Request, Response } from "express";\n'
    'import rateLimit, { ipKeyGenerator } from "express-rate-limit";\n'
    'import multer from "multer";\n'
    'import fs from "fs";\n'
    'import path from "path";\n'
    'import os from "os";\n'
    'import crypto from "crypto";\n'
    'import ffmpeg from "fluent-ffmpeg";\n'
    'import { masterAudioFile } from "../services/mastering";\n\n'
    + helper + "\n\n" + lod + "\n"
)
with open("server/routes/common.ts", "w", encoding="utf-8") as f:
    f.write(common)
print(f"wrote server/routes/common.ts ({len(common.splitlines())} lines)")

# ---- rewrite routes.ts ----
mounted = set()
out_lines = []
for i, ln in enumerate(lines, start=1):
    hit = next(((s, e, d) for s, e, d in REGIONS if s == i), None)
    if hit:
        s, e, d = hit
        if d not in mounted:
            mounted.add(d)
            sig = "storage" if re.search(r"\bstorage\b", strip_comments(transform("\n".join(bodies[d])))) else ""
            out_lines.append(f'  app.use("/", {FACTORY[d]}({sig}));')
        continue
    if any(s <= i <= e for s, e, _ in REGIONS):
        continue
    if any(s <= i <= e for s, e in REMOVE):
        continue
    out_lines.append(ln)

# prune imports: check each imported name against the non-import, comment-free body
body_only = strip_comments("\n".join(l for l in out_lines if not l.startswith("import ")))
pruned = []
import_re = re.compile(r'^import\s+(.*?)\s+from\s+"([^"]+)";$')
for ln in out_lines:
    m = import_re.match(ln)
    if not m:
        pruned.append(ln)
        continue
    clause, mod = m.groups()
    if clause.startswith("type "):
        inner = clause[5:].strip().strip("{}")
        names = [x.strip() for x in inner.split(",") if x.strip()]
        keep = [n for n in names if re.search(rf"\b{re.escape(n)}\b", body_only)]
        if keep:
            pruned.append(f'import type {{ {", ".join(keep)} }} from "{mod}";')
        continue
    default_m = re.match(r"^([A-Za-z_$][\w$]*)\s*,\s*\{(.*)\}$", clause)
    if default_m:
        dname, inner = default_m.groups()
        names = [x.strip() for x in inner.split(",") if x.strip()]
        keepd = dname if re.search(rf"\b{re.escape(dname)}\b", body_only) else None
        keepn = []
        for n in names:
            un = n.split(" as ")[-1].strip()
            un = un[5:] if un.startswith("type ") else un
            if re.search(rf"\b{re.escape(un)}\b", body_only):
                keepn.append(n)
        if keepd and keepn:
            pruned.append(f'import {keepd}, {{ {", ".join(keepn)} }} from "{mod}";')
        elif keepd:
            pruned.append(f'import {keepd} from "{mod}";')
        elif keepn:
            pruned.append(f'import {{ {", ".join(keepn)} }} from "{mod}";')
        continue
    if clause.startswith("{"):
        names = [x.strip() for x in clause.strip("{}").split(",") if x.strip()]
        keepn = []
        for n in names:
            un = n.split(" as ")[-1].strip()
            un = un[5:] if un.startswith("type ") else un
            if re.search(rf"\b{re.escape(un)}\b", body_only):
                keepn.append(n)
        if keepn:
            pruned.append(f'import {{ {", ".join(keepn)} }} from "{mod}";')
        continue
    dname = clause.strip()
    if re.search(rf"\b{re.escape(dname)}\b", body_only):
        pruned.append(ln)

# add new factory imports after the last import line
last_imp = max(i for i, l in enumerate(pruned) if l.startswith("import "))
new_imports = [f'import {{ {FACTORY[d]} }} from "./routes/{d}";' for d in ORDER]
pruned = pruned[:last_imp+1] + new_imports + pruned[last_imp+1:]

with open(SRC, "w", encoding="utf-8") as f:
    f.write("\n".join(pruned))
print(f"routes.ts -> {len(pruned)} lines")
