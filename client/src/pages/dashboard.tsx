import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Music, Code, Upload, Drum, Mic, Shield, MessageSquare, Zap, BarChart3, Layers, Sparkles } from "lucide-react";

export default function Dashboard() {
  const quickActions = [
    {
      title: "Music Studio",
      description: "Professional multi-instrument composition",
      icon: Music,
      href: "/music-studio",
      color: "bg-purple-500"
    },
    {
      title: "Song Uploader",
      description: "Upload and analyze audio files",
      icon: Upload,
      href: "/song-uploader", 
      color: "bg-blue-500"
    },
    {
      title: "Code Translator",
      description: "Translate between programming languages",
      icon: Code,
      href: "/code-translator",
      color: "bg-green-500"
    },
    {
      title: "Beat Maker",
      description: "Create professional drum patterns",
      icon: Drum,
      href: "/beat-studio",
      color: "bg-orange-500"
    },
    {
      title: "Code to Music",
      description: "Transform code into musical compositions",
      icon: Zap,
      href: "/codebeat-studio",
      color: "bg-yellow-500"
    },
    {
      title: "AI Assistant", 
      description: "Get help with coding and music",
      icon: MessageSquare,
      href: "/ai-assistant",
      color: "bg-pink-500"
    },
    {
      title: "Advanced Sequencer",
      description: "Professional multi-layered beat production",
      icon: Layers,
      href: "/advanced-sequencer", 
      color: "bg-orange-500"
    },
    {
      title: "Granular Engine",
      description: "Advanced texture manipulation & synthesis",
      icon: Sparkles,
      href: "/granular-engine",
      color: "bg-purple-500"
    },
    {
      title: "Pack Generator",
      description: "AI-powered sample pack creation from prompts",
      icon: Music,
      href: "/pack-generator",
      color: "bg-emerald-500"
    }
  ];

  return (
    <div className="p-6 space-y-6 min-w-[1400px]">
      <div className="w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your creative workspace</p>
        </div>
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Created</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 from last week</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Code Translations</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">48</div>
            <p className="text-xs text-muted-foreground">+12 from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Songs Analyzed</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+8 from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <Card className="transition-transform hover:scale-105 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>{action.description}</CardDescription>
                  <Button className="w-full">Open</Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Music className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Created "Electronic Symphony"</p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Code className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Translated Python to JavaScript</p>
                <p className="text-xs text-muted-foreground">4 hours ago</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Analyzed "Summer Vibes.mp3"</p>
                <p className="text-xs text-muted-foreground">1 day ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}