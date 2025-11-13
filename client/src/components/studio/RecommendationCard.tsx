import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, AlertCircle, Info, AlertTriangle, Target } from "lucide-react";
import { useLocation } from "wouter";
import { navigateToTool, getToolDisplayName } from "@/lib/toolNavigation";
import type { Recommendation } from "@shared/schema";

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    navigateToTool(
      {
        toolId: recommendation.targetTool,
        payload: recommendation.navigationPayload,
      },
      setLocation
    );
  };

  const getSeverityIcon = () => {
    switch (recommendation.severity) {
      case "high":
        return <AlertCircle className="h-4 w-4" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4" />;
      case "low":
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = () => {
    switch (recommendation.severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
    }
  };

  const toolDisplayName = getToolDisplayName(recommendation.targetTool);

  return (
    <Card
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={handleClick}
      data-testid={`recommendation-${recommendation.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {getSeverityIcon()}
            <Badge variant={getSeverityColor()} className="capitalize">
              {recommendation.severity}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {recommendation.category.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm font-medium">{recommendation.message}</p>
        </div>
        <Button
          size="sm"
          variant="default"
          className="shrink-0"
          data-testid={`button-open-${recommendation.targetTool}`}
        >
          {toolDisplayName}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

interface RecommendationListProps {
  recommendations: Recommendation[];
}

export function RecommendationList({ recommendations }: RecommendationListProps) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const highPriority = recommendations.filter((r) => r.severity === "high");
  const mediumPriority = recommendations.filter((r) => r.severity === "medium");
  const lowPriority = recommendations.filter((r) => r.severity === "low");

  return (
    <div className="space-y-6" data-testid="recommendation-list">
      <div className="flex items-center justify-between" data-testid="heading-quick-fixes">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Quick Fixes</h3>
        </div>
        <Badge variant="outline">
          {recommendations.length} {recommendations.length === 1 ? "Recommendation" : "Recommendations"}
        </Badge>
      </div>

      {highPriority.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">High Priority</h4>
          {highPriority.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}

      {mediumPriority.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Medium Priority</h4>
          {mediumPriority.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}

      {lowPriority.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Low Priority</h4>
          {lowPriority.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}
    </div>
  );
}
