import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Cpu, 
  HardDrive,
  Wifi,
  Volume2
} from "lucide-react";

interface MetricData {
  label: string;
  value: number;
  unit: string;
  status: "good" | "warning" | "critical";
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<MetricData[]>([
    { label: "CPU Usage", value: 45, unit: "%", status: "good" },
    { label: "Memory Usage", value: 68, unit: "%", status: "warning" },
    { label: "Audio Latency", value: 12, unit: "ms", status: "good" },
    { label: "Buffer Size", value: 256, unit: "samples", status: "good" },
    { label: "Sample Rate", value: 44100, unit: "Hz", status: "good" },
    { label: "Active Tracks", value: 8, unit: "", status: "good" }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: metric.label === "CPU Usage" 
          ? Math.max(20, Math.min(90, metric.value + (Math.random() - 0.5) * 10))
          : metric.label === "Memory Usage"
          ? Math.max(30, Math.min(95, metric.value + (Math.random() - 0.5) * 8))
          : metric.label === "Audio Latency"
          ? Math.max(5, Math.min(50, metric.value + (Math.random() - 0.5) * 4))
          : metric.value
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good": return "bg-green-100 text-green-800";
      case "warning": return "bg-yellow-100 text-yellow-800";
      case "critical": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getIcon = (label: string) => {
    switch (label) {
      case "CPU Usage": return <Cpu className="h-4 w-4" />;
      case "Memory Usage": return <HardDrive className="h-4 w-4" />;
      case "Audio Latency": return <Volume2 className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getIcon(metric.label)}
                      <span className="font-medium text-sm">{metric.label}</span>
                    </div>
                    <Badge variant="outline" className={getStatusColor(metric.status)}>
                      {metric.status}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">
                    {metric.value.toFixed(metric.label === "Audio Latency" ? 1 : 0)}
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      {metric.unit}
                    </span>
                  </div>
                  
                  {/* Progress bar for percentage metrics */}
                  {metric.unit === "%" && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metric.status === "good" ? "bg-green-500" :
                            metric.status === "warning" ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${metric.value}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System Info */}
          <div className="mt-6">
            <h3 className="font-medium mb-4">System Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Audio Driver:</span>
                <span className="ml-2">ASIO</span>
              </div>
              <div>
                <span className="text-gray-600">Audio Device:</span>
                <span className="ml-2">Default Audio</span>
              </div>
              <div>
                <span className="text-gray-600">Bit Depth:</span>
                <span className="ml-2">24-bit</span>
              </div>
              <div>
                <span className="text-gray-600">Buffer Size:</span>
                <span className="ml-2">256 samples</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
