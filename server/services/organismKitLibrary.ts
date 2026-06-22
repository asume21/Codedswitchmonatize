import fs from "fs";
import path from "path";

export type OrganismKitRole = "kick" | "snare" | "hat" | "perc" | "tom" | "bass808" | "loop";

export interface OrganismKitSample {
  role: OrganismKitRole;
  filePath: string;
  relativePath: string;
  fileName: string;
  sourceKit: string;
  rootNote?: string;
}

export interface OrganismKit {
  id: string;
  name: string;
  licenseNote: string;
  root: string;
  samples: OrganismKitSample[];
  priority: number;
}

const PRIVATE_KIT_ROOT = path.resolve(process.cwd(), "private", "organism-kits");
const COMMITTED_KIT_ROOT = path.resolve(process.cwd(), "server", "Assets", "organism-kits");
const RAILWAY_OBJECTS_KIT_ROOT = path.resolve("/app", "objects", "organism-kits");
const DATA_VOLUME_KIT_ROOT = path.resolve("/data", "organism-kits");

// Like \b but treats underscore as a separator. Sample-pack filenames
// commonly use snake_case (E808_BD-01.wav, MV1_SD_02.wav) where the
// stock \b fails because underscore is a \w word-char — `\bBD\b` won't
// match `_BD[` because `_` → `B` is word→word, no boundary.
function sep(alt: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])(?:${alt})(?![A-Za-z0-9])`, 'i');
}

// Order matters: specific drum roles are checked BEFORE the generic
// bass808 fallback so kit prefixes like "TR808 BD Bass Drum.wav" or
// "E808_SD-01.wav" are tagged by their role keyword (BD → kick,
// SD → snare) rather than swept into bass808 by the literal "808".
const ROLE_PATTERNS: Array<[OrganismKitRole, RegExp]> = [
  ["kick",    sep('kick|kicks|bd')],
  ["snare",   sep('snare|snares|sd')],
  ["hat",     sep('hat|hats|hihat|hihats|hi-hat|hi-hats|closed-hat|open-hat|ch|oh')],
  ["perc",    sep('perc|percussion|clap|claps|rim|rimshot|snap|shaker|cowbell|cp|cb|rs|cl|ma')],
  ["tom",     sep('tom|toms|fill|fills|lt|mt|ht|hc|mc|lc')],
  ["loop",    sep('loop|loops|drumloop|toploop|groove|grooves')],
  ["bass808", sep('808|sub|bass')],
];

function walkWavs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /\.(wav|aiff|aif|mp3)$/i.test(entry.name)) out.push(full);
    }
  }
  return out;
}

function hasKitSamples(root: string): boolean {
  if (!fs.existsSync(root)) return false;
  try {
    return fs.readdirSync(root, { withFileTypes: true }).some((entry) => {
      if (!entry.isDirectory()) return false;
      return walkWavs(path.join(root, entry.name)).length > 0;
    });
  } catch {
    return false;
  }
}

function getDefaultKitRootCandidates(): string[] {
  const productionCandidates = [
    RAILWAY_OBJECTS_KIT_ROOT,
    DATA_VOLUME_KIT_ROOT,
    COMMITTED_KIT_ROOT,
    PRIVATE_KIT_ROOT,
  ];

  const developmentCandidates = [
    PRIVATE_KIT_ROOT,
    COMMITTED_KIT_ROOT,
    RAILWAY_OBJECTS_KIT_ROOT,
    DATA_VOLUME_KIT_ROOT,
  ];

  return process.env.NODE_ENV === "production" ? productionCandidates : developmentCandidates;
}

function roleForFile(fileName: string): OrganismKitRole | null {
  for (const [role, pattern] of ROLE_PATTERNS) {
    if (pattern.test(fileName)) return role;
  }
  return null;
}

function readLicenseNote(root: string): string {
  for (const name of ["LICENSE.txt", "LICENSE.md", "license.txt", "README.txt", "README.md"]) {
    const candidate = path.join(root, name);
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf8").slice(0, 800);
    }
  }
  return "No license file found in kit folder. Treat as private/internal only until license is verified.";
}

function readPriority(root: string): number {
  const candidate = path.join(root, "priority.txt");
  if (!fs.existsSync(candidate)) return 0;
  const raw = fs.readFileSync(candidate, "utf8").trim();
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function readKitRootNote(root: string): string | undefined {
  const candidate = path.join(root, "bass808-root.txt");
  if (!fs.existsSync(candidate)) return undefined;
  return fs.readFileSync(candidate, "utf8").trim() || undefined;
}

export function getOrganismKitRoot(): string {
  if (process.env.ORGANISM_KIT_ROOT) return process.env.ORGANISM_KIT_ROOT;

  const candidates = getDefaultKitRootCandidates();
  return candidates.find(hasKitSamples) ?? candidates[0];
}

export function listOrganismKits(): OrganismKit[] {
  const root = getOrganismKitRoot();
  if (!fs.existsSync(root)) return [];

  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const kitRoot = path.join(root, entry.name);
      const kitRootNote = readKitRootNote(kitRoot);
      const samples = walkWavs(kitRoot)
        .map((filePath): OrganismKitSample | null => {
          const fileName = path.basename(filePath);
          const role = roleForFile(fileName);
          if (!role) return null;
          return {
            role,
            filePath,
            relativePath: path.relative(kitRoot, filePath).split(path.sep).join("/"),
            fileName,
            sourceKit: entry.name,
            rootNote: role === "bass808" ? kitRootNote : undefined,
          };
        })
        .filter((sample): sample is OrganismKitSample => Boolean(sample));

      return {
        id: entry.name,
        name: entry.name.replace(/[-_]+/g, " "),
        licenseNote: readLicenseNote(kitRoot),
        root: kitRoot,
        samples,
        priority: readPriority(kitRoot),
      };
    })
    .filter((kit) => kit.samples.length > 0);
}

export function findOrganismKitSample(kitId: string, relativePath: string): OrganismKitSample | null {
  const kit = listOrganismKits().find((candidate) => candidate.id === kitId);
  if (!kit) return null;

  const normalizedRelative = relativePath.replace(/\\/g, "/");
  return kit.samples.find((sample) => sample.relativePath === normalizedRelative) ?? null;
}

export function pickBestOrganismKit(preferredRoles: OrganismKitRole[] = ["kick", "snare", "hat", "bass808"]): OrganismKit | null {
  const kits = listOrganismKits();
  if (!kits.length) return null;

  return kits
    .map((kit) => {
      const roles = new Set(kit.samples.map((sample) => sample.role));
      const roleScore = preferredRoles.reduce((score, role) => score + (roles.has(role) ? 10 : 0), 0);
      const sizeScore = Math.min(kit.samples.length, 100) / 10;
      return { kit, score: roleScore + sizeScore + kit.priority };
    })
    .sort((a, b) => b.score - a.score || b.kit.samples.length - a.kit.samples.length)[0]?.kit ?? null;
}
