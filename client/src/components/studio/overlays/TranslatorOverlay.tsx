import { useState } from "react";
import { Code2, FileCode2, Loader2, Play, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAbortableRequest, isAbortError } from "@/hooks/use-abortable-request";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";

interface TranslatorOverlayProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "csharp", label: "C#" },
] as const;

const PLACEHOLDER_CODE = `function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(fibonacci(i));
}`;

/**
 * ⌘K Code Translator overlay. Translates source code between programming
 * languages (the original CodedSwitch feature) via `/api/ai/translate-code`.
 * Replaces the standalone CodeTranslator tab that was retired during the
 * surface consolidation — the engine lives here now so there's only one path.
 */
export default function TranslatorOverlay({ open, onClose }: TranslatorOverlayProps) {
  const [sourceLanguage, setSourceLanguage] = useState<string>("javascript");
  const [targetLanguage, setTargetLanguage] = useState<string>("python");
  const [aiProvider, setAiProvider] = useState<string>("grok");
  const [source, setSource] = useState<string>(PLACEHOLDER_CODE);
  const [output, setOutput] = useState<string>("");

  const { toast } = useToast();
  const getAbortSignal = useAbortableRequest();

  const translateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/ai/translate-code",
        { sourceCode: source, sourceLanguage, targetLanguage, aiProvider },
        { signal: getAbortSignal() },
      );
      return response.json();
    },
    onSuccess: (data) => {
      setOutput(data.translatedCode ?? "");
      toast({ title: "Translation complete", description: `Translated to ${targetLanguage}.` });
    },
    onError: (error) => {
      if (isAbortError(error)) return;
      toast({
        title: "Translation failed",
        description: "Could not translate the code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTranslate = () => {
    if (!source.trim()) {
      toast({
        title: "No code provided",
        description: "Paste some code to translate first.",
        variant: "destructive",
      });
      return;
    }
    translateMutation.mutate();
  };

  const copyOutput = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Translated code copied to clipboard." });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        data-testid="studio-shell-overlay-translator"
        className={cn(
          // Override default dialog: wide, tall, terminal aesthetic
          "max-w-5xl w-[92vw] h-[80vh] p-0 gap-0 overflow-hidden",
          "bg-zinc-950/95 backdrop-blur-2xl",
          "border border-emerald-500/20 shadow-[0_0_80px_-20px_rgba(16,185,129,0.4)]",
          "text-emerald-50 font-mono flex flex-col",
        )}
      >
        <TranslatorHeader
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          aiProvider={aiProvider}
          onSourceLanguageChange={setSourceLanguage}
          onTargetLanguageChange={setTargetLanguage}
          onAiProviderChange={setAiProvider}
          onClose={onClose}
        />

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-emerald-500/10">
          <CodePane
            label="Source"
            icon={<Code2 className="w-3.5 h-3.5" />}
            value={source}
            onChange={setSource}
            language={sourceLanguage}
            editable
          />
          <CodePane
            label="Translated Code"
            icon={<FileCode2 className="w-3.5 h-3.5" />}
            value={output}
            placeholder="// Translated code appears here…"
            language={targetLanguage}
            editable={false}
            onCopy={output ? copyOutput : undefined}
          />
        </div>

        <TranslatorFooter
          onClose={onClose}
          onTranslate={handleTranslate}
          isPending={translateMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

function LanguageSelect({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  testId: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      className={cn(
        "text-[11px] uppercase tracking-wider font-mono",
        "bg-black/60 border border-emerald-500/25 rounded px-2 py-1",
        "text-emerald-200 focus:outline-none focus:border-emerald-400/60",
        "cursor-pointer",
      )}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value} className="bg-zinc-950">
          {lang.label}
        </option>
      ))}
    </select>
  );
}

function TranslatorHeader({
  sourceLanguage,
  targetLanguage,
  aiProvider,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onAiProviderChange,
  onClose,
}: {
  sourceLanguage: string;
  targetLanguage: string;
  aiProvider: string;
  onSourceLanguageChange: (next: string) => void;
  onTargetLanguageChange: (next: string) => void;
  onAiProviderChange: (next: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-emerald-500/15 bg-black/40">
      {/* Terminal-style window dots */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="hidden sm:inline text-[11px] tracking-[0.2em] uppercase text-emerald-300/80 select-none">
          codedswitch · translator
        </span>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSelect value={sourceLanguage} onChange={onSourceLanguageChange} testId="translator-source-language" />
        <span className="text-emerald-400/60 text-xs select-none">→</span>
        <LanguageSelect value={targetLanguage} onChange={onTargetLanguageChange} testId="translator-target-language" />
        <div className="hidden md:block">
          <AIProviderSelector value={aiProvider} onValueChange={onAiProviderChange} />
        </div>
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
  placeholder,
  language,
  editable,
  onCopy,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  language: string;
  editable: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex flex-col min-h-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_60%)]">
      <div className="flex items-center justify-between px-4 py-2 text-[10px] tracking-[0.2em] uppercase text-emerald-400/60 border-b border-emerald-500/5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-emerald-500/40">{language.toLowerCase()}</span>
          {onCopy && (
            <button
              onClick={onCopy}
              className="text-emerald-300/70 hover:text-emerald-100 tracking-wider"
              data-testid="translator-copy"
            >
              copy
            </button>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!editable}
        spellCheck={false}
        placeholder={placeholder}
        data-testid={`translator-pane-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "flex-1 min-h-0 resize-none bg-transparent px-4 py-3",
          "text-[13px] leading-relaxed font-mono text-emerald-100",
          "placeholder:text-emerald-500/30 caret-emerald-300",
          "focus:outline-none",
          !editable && "text-emerald-200/70",
        )}
      />
    </div>
  );
}

function TranslatorFooter({
  onClose,
  onTranslate,
  isPending,
}: {
  onClose: () => void;
  onTranslate: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-emerald-500/15 bg-black/40">
      <div className="flex items-center gap-3 text-[10px] tracking-wider text-emerald-500/50 uppercase">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isPending ? "bg-yellow-400 animate-pulse" : "bg-emerald-400 animate-pulse",
            )}
          />
          {isPending ? "translating" : "ready"}
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
          onClick={onTranslate}
          disabled={isPending}
          data-testid="translator-run"
          className={cn(
            "h-8 gap-1.5 text-[11px] uppercase tracking-wider font-mono",
            "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100",
            "border border-emerald-400/40 disabled:opacity-40",
          )}
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {isPending ? "Translating" : "Translate"}
        </Button>
      </div>
    </div>
  );
}
