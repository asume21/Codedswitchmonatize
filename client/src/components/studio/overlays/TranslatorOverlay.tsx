import { useState } from "react";
import { Code2, Music2, Play, X } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TranslatorOverlayProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES = ["JavaScript", "Python", "TypeScript", "Rust", "Go"] as const;
type Language = (typeof LANGUAGES)[number];

const PLACEHOLDER_CODE = `// Paste a function and translate its shape into a musical structure.
function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`;

export default function TranslatorOverlay({ open, onClose }: TranslatorOverlayProps) {
  const [language, setLanguage] = useState<Language>("JavaScript");
  const [source, setSource] = useState(PLACEHOLDER_CODE);
  const [output] = useState<string>(
    "// Music structure output appears here.\n// Translation engine wires in a follow-up."
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        data-testid="studio-shell-overlay-translator"
        className={cn(
          // Override default dialog: wide, tall, terminal aesthetic
          "max-w-5xl w-[92vw] h-[80vh] p-0 gap-0 overflow-hidden",
          "bg-zinc-950/95 backdrop-blur-2xl",
          "border border-emerald-500/20 shadow-[0_0_80px_-20px_rgba(16,185,129,0.4)]",
          "text-emerald-50 font-mono flex flex-col"
        )}
      >
        <TranslatorHeader language={language} onLanguageChange={setLanguage} onClose={onClose} />

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-emerald-500/10">
          <CodePane
            label="Source"
            icon={<Code2 className="w-3.5 h-3.5" />}
            value={source}
            onChange={setSource}
            language={language}
            editable
          />
          <CodePane
            label="Music Structure"
            icon={<Music2 className="w-3.5 h-3.5" />}
            value={output}
            language="structure"
            editable={false}
          />
        </div>

        <TranslatorFooter onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function TranslatorHeader({
  language,
  onLanguageChange,
  onClose,
}: {
  language: Language;
  onLanguageChange: (next: Language) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/15 bg-black/40">
      {/* Terminal-style window dots */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-[11px] tracking-[0.2em] uppercase text-emerald-300/80 select-none">
          codedswitch · translator
        </span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
          data-testid="translator-language"
          className={cn(
            "text-[11px] uppercase tracking-wider font-mono",
            "bg-black/60 border border-emerald-500/25 rounded px-2 py-1",
            "text-emerald-200 focus:outline-none focus:border-emerald-400/60",
            "cursor-pointer"
          )}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-zinc-950">
              {lang}
            </option>
          ))}
        </select>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-emerald-300/60 hover:text-emerald-100 hover:bg-emerald-500/10"
          onClick={onClose}
          title="Close"
          data-testid="translator-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function CodePane({
  label,
  icon,
  value,
  onChange,
  language,
  editable,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange?: (next: string) => void;
  language: string;
  editable: boolean;
}) {
  return (
    <div className="flex flex-col min-h-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_60%)]">
      <div className="flex items-center justify-between px-4 py-2 text-[10px] tracking-[0.2em] uppercase text-emerald-400/60 border-b border-emerald-500/5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-emerald-500/40">{language.toLowerCase()}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!editable}
        spellCheck={false}
        data-testid={`translator-pane-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "flex-1 min-h-0 resize-none bg-transparent px-4 py-3",
          "text-[13px] leading-relaxed font-mono text-emerald-100",
          "placeholder:text-emerald-500/30 caret-emerald-300",
          "focus:outline-none",
          !editable && "text-emerald-200/70"
        )}
      />
    </div>
  );
}

function TranslatorFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-emerald-500/15 bg-black/40">
      <div className="flex items-center gap-3 text-[10px] tracking-wider text-emerald-500/50 uppercase">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ready
        </span>
        <span>·</span>
        <span>esc to close</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-[11px] uppercase tracking-wider text-emerald-300/70 hover:text-emerald-100 hover:bg-emerald-500/10 h-8"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled
          data-testid="translator-run"
          className={cn(
            "h-8 gap-1.5 text-[11px] uppercase tracking-wider font-mono",
            "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100",
            "border border-emerald-400/40 disabled:opacity-40"
          )}
          title="Translation engine wires in a follow-up"
        >
          <Play className="w-3 h-3" />
          Translate
        </Button>
      </div>
    </div>
  );
}
