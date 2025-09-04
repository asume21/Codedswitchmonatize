import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MusicMetrics {
  session: string;
  timestamp: number;
  language: string;
  codeComplexity: {
    lines: number;
    functions: number;
    classes: number;
    variables: number;
    loops: number;
  };
  musicGeneration: {
    totalNotes: number;
    instruments: string[];
    noteDistribution: { [instrument: string]: number };
    averageNoteDuration: number;
    rhythmComplexity: number;
    harmonicDiversity: number;
  };
  performance: {
    generationTimeMs: number;
    aiModel: string;
    fallbackUsed: boolean;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  pattern: {
    kick: number;
    snare: number;
    hihat: number;
    bass: number;
    totalHits: number;
  };
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<MusicMetrics[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MusicMetrics | null>(null);

  // Load metrics from localStorage on component mount
  useEffect(() => {
    const savedMetrics = localStorage.getItem('codeMusic_metrics');
    if (savedMetrics) {
      try {
        setMetrics(JSON.parse(savedMetrics));
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    }

    // Listen for new metrics from code compilation
    const handleMetricsUpdate = (event: CustomEvent) => {
      const newMetric = event.detail as MusicMetrics;
      setMetrics(prev => {
        const updated = [newMetric, ...prev].slice(0, 50); // Keep last 50 entries
        localStorage.setItem('codeMusic_metrics', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('codeMusic_metricsUpdate', handleMetricsUpdate as EventListener);
    return () => {
      window.removeEventListener('codeMusic_metricsUpdate', handleMetricsUpdate as EventListener);
    };
  }, []);

  const getOverallStats = () => {
    if (metrics.length === 0) return null;

    const totalSessions = metrics.length;
    const avgGenerationTime = metrics.reduce((sum, m) => sum + m.performance.generationTimeMs, 0) / totalSessions;
    const fallbackRate = (metrics.filter(m => m.performance.fallbackUsed).length / totalSessions) * 100;
    const mostUsedLanguage = metrics.reduce((acc, m) => {
      acc[m.language] = (acc[m.language] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    const topLanguage = Object.entries(mostUsedLanguage).sort((a, b) => b[1] - a[1])[0];

    const avgInstruments = metrics.reduce((sum, m) => sum + m.musicGeneration.instruments.length, 0) / totalSessions;
    const qualityDistribution = metrics.reduce((acc, m) => {
      acc[m.performance.quality] = (acc[m.performance.quality] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      totalSessions,
      avgGenerationTime: Math.round(avgGenerationTime),
      fallbackRate: Math.round(fallbackRate * 10) / 10,
      topLanguage: topLanguage ? topLanguage[0] : 'N/A',
      avgInstruments: Math.round(avgInstruments * 10) / 10,
      qualityDistribution
    };
  };

  const stats = getOverallStats();

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-studio-bg text-white">
      <div className="flex-none p-6 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-studio-accent">Performance Metrics</h2>
            <p className="text-gray-400 mt-2">
              AI Code-to-Music generation analytics and performance insights
            </p>
          </div>
          <div className="flex space-x-2">
            <Badge variant="outline" className="border-studio-accent text-studio-accent">
              {metrics.length} Sessions
            </Badge>
            <Badge variant="outline" className="border-green-500 text-green-500">
              Live Tracking
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        {!stats ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-chart-bar text-gray-400 text-xl"></i>
            </div>
            <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
            <p className="text-gray-400">
              Generate some music from code to see performance metrics here
            </p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full bg-studio-panel">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-studio-panel border-gray-600">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Sessions</CardDescription>
                    <CardTitle className="text-2xl text-studio-accent">
                      {stats.totalSessions}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-studio-panel border-gray-600">
                  <CardHeader className="pb-2">
                    <CardDescription>Avg Generation Time</CardDescription>
                    <CardTitle className="text-2xl text-blue-400">
                      {formatDuration(stats.avgGenerationTime)}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-studio-panel border-gray-600">
                  <CardHeader className="pb-2">
                    <CardDescription>Fallback Rate</CardDescription>
                    <CardTitle className="text-2xl text-yellow-400">
                      {stats.fallbackRate}%
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-studio-panel border-gray-600">
                  <CardHeader className="pb-2">
                    <CardDescription>Top Language</CardDescription>
                    <CardTitle className="text-2xl text-green-400">
                      {stats.topLanguage}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-studio-panel border-gray-600">
                  <CardHeader>
                    <CardTitle>Quality Distribution</CardTitle>
                    <CardDescription>AI generation quality metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(stats.qualityDistribution).map(([quality, count]) => (
                      <div key={quality} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getQualityColor(quality)}`}></div>
                          <span className="capitalize">{quality}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-400">{count}</span>
                          <Progress 
                            value={(count / stats.totalSessions) * 100} 
                            className="w-20 h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-studio-panel border-gray-600">
                  <CardHeader>
                    <CardTitle>Performance Trends</CardTitle>
                    <CardDescription>Recent generation statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Avg Instruments per Track</span>
                      <span className="text-studio-accent font-mono">
                        {stats.avgInstruments}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>AI Success Rate</span>
                      <span className="text-green-400 font-mono">
                        {Math.round((100 - stats.fallbackRate) * 10) / 10}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Most Recent Quality</span>
                      <Badge className={`${getQualityColor(metrics[0]?.performance.quality || 'fair')} text-white`}>
                        {metrics[0]?.performance.quality || 'N/A'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <div className="space-y-4">
                {metrics.slice(0, 20).map((metric, index) => (
                  <Card key={metric.session} className="bg-studio-panel border-gray-600 cursor-pointer hover:bg-gray-800 transition-colors"
                        onClick={() => setSelectedMetric(selectedMetric?.session === metric.session ? null : metric)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getQualityColor(metric.performance.quality)}`}></div>
                          <div>
                            <div className="font-medium">
                              {metric.language} • {metric.musicGeneration.instruments.length} instruments
                            </div>
                            <div className="text-sm text-gray-400">
                              {new Date(metric.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline" className="border-blue-400 text-blue-400">
                            {metric.musicGeneration.totalNotes} notes
                          </Badge>
                          <span className="text-sm text-gray-400">
                            {formatDuration(metric.performance.generationTimeMs)}
                          </span>
                          {metric.performance.fallbackUsed && (
                            <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                              Fallback
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {selectedMetric?.session === metric.session && (
                        <div className="mt-4 pt-4 border-t border-gray-600 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium mb-2">Code Complexity</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span>Lines:</span>
                                  <span>{metric.codeComplexity.lines}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Functions:</span>
                                  <span>{metric.codeComplexity.functions}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Classes:</span>
                                  <span>{metric.codeComplexity.classes}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium mb-2">Music Analysis</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span>Rhythm Complexity:</span>
                                  <span>{metric.musicGeneration.rhythmComplexity.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Harmonic Diversity:</span>
                                  <span>{metric.musicGeneration.harmonicDiversity.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Avg Note Duration:</span>
                                  <span>{metric.musicGeneration.averageNoteDuration.toFixed(2)}s</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-2">Instrument Distribution</h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(metric.musicGeneration.noteDistribution).map(([instrument, count]) => (
                                <Badge key={instrument} variant="outline" className="border-purple-400 text-purple-400">
                                  {instrument}: {count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <Card className="bg-studio-panel border-gray-600">
                <CardHeader>
                  <CardTitle>Advanced Analytics</CardTitle>
                  <CardDescription>Deep insights into code-to-music generation patterns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-8">
                    <i className="fas fa-chart-line text-gray-400 text-3xl mb-4"></i>
                    <p className="text-gray-400">Advanced analytics coming soon...</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Will include trend analysis, pattern recognition, and optimization suggestions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </ScrollArea>
    </div>
  );
}