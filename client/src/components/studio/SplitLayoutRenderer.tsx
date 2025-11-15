import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, GripHorizontal } from "lucide-react";

interface PanelNode {
  id: string;
  type: "panel";
  content: string;
  size?: number;
}

interface SplitNode {
  id: string;
  type: "split";
  direction: "horizontal" | "vertical";
  children: (PanelNode | SplitNode)[];
  size?: number;
}

interface SplitLayoutConfig {
  version: string;
  splitLayout: SplitNode;
  metadata: {
    created: string;
    density: "dense" | "comfortable" | "spacious";
  };
}

interface SplitLayoutRendererProps {
  config: SplitLayoutConfig;
  contentMap: Record<string, React.ReactNode>;
}

export function SplitLayoutRenderer({ config, contentMap }: SplitLayoutRendererProps) {
  const renderNode = (node: PanelNode | SplitNode): React.ReactNode => {
    if (node.type === "panel") {
      const content = contentMap[node.content];
      return (
        <div
          key={node.id}
          className="flex flex-col h-full overflow-hidden"
          style={{ flex: node.size || 1 }}
        >
          {content || (
            <Card className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">
                {node.content} panel
              </div>
            </Card>
          )}
        </div>
      );
    }

    // Split node
    const isHorizontal = node.direction === "horizontal";
    return (
      <div
        key={node.id}
        className={`flex ${isHorizontal ? "flex-row" : "flex-col"} h-full gap-2`}
        style={{ flex: node.size || 1 }}
      >
        {node.children.map((child, index) => (
          <div
            key={child.id}
            className="flex overflow-hidden"
            style={{ flex: child.size || 1 }}
          >
            {renderNode(child)}
          </div>
        ))}
      </div>
    );
  };

  const density = config.metadata.density || "comfortable";
  const paddingClass = {
    dense: "p-2",
    comfortable: "p-4",
    spacious: "p-6"
  }[density];

  return (
    <div className={`h-full w-full ${paddingClass}`}>
      {renderNode(config.splitLayout)}
    </div>
  );
}
