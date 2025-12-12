import { Badge } from "@/components/ui/badge";
import { useStudioSession } from "@/contexts/StudioSessionContext";
import { Music2, Drum, Wand2 } from "lucide-react";

export function SessionStatusIndicators() {
  const session = useStudioSession();

  const hasBeat = !!session.pattern && typeof session.pattern === "object";
  const hasMelody = Array.isArray(session.melody) && session.melody.length > 0;
  const hasMusic = session.hasGeneratedMusic;

  if (!hasBeat && !hasMelody && !hasMusic) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {hasBeat && (
        <Badge variant="outline" className="border-blue-400 text-blue-200 flex items-center gap-1">
          <Drum className="w-3 h-3" />
          <span>Beat Ready</span>
        </Badge>
      )}
      {hasMelody && (
        <Badge variant="outline" className="border-purple-400 text-purple-200 flex items-center gap-1">
          <Music2 className="w-3 h-3" />
          <span>Melody Ready</span>
        </Badge>
      )}
      {hasMusic && (
        <Badge variant="outline" className="border-green-400 text-green-200 flex items-center gap-1">
          <Wand2 className="w-3 h-3" />
          <span>Song Generated</span>
        </Badge>
      )}
    </div>
  );
}
