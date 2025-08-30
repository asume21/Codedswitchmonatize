import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Code, Mic, Headphones, Settings } from "lucide-react";

export default function UnifiedMusicStudio() {
  const [activeTab, setActiveTab] = useState("compose");

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-6 w-6" />
            Unified Music Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="compose" className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Code
              </TabsTrigger>
              <TabsTrigger value="record" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Record
              </TabsTrigger>
              <TabsTrigger value="mix" className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Mix
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="mt-6 h-full">
              <div className="grid grid-cols-2 gap-6 h-full">
                <Card>
                  <CardHeader>
                    <CardTitle>Melody Composer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button className="w-full">Start Composing</Button>
                      <p className="text-sm text-gray-600">
                        Create melodies with AI assistance
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Beat Maker</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button className="w-full">Create Beats</Button>
                      <p className="text-sm text-gray-600">
                        Generate rhythmic patterns
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="code" className="mt-6 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Code to Music</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button className="w-full">Convert Code</Button>
                    <p className="text-sm text-gray-600">
                      Transform your code into musical compositions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="record" className="mt-6 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Recording Studio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button className="w-full">Start Recording</Button>
                    <p className="text-sm text-gray-600">
                      Record audio with professional quality
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mix" className="mt-6 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Mixing Console</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button className="w-full">Open Mixer</Button>
                    <p className="text-sm text-gray-600">
                      Professional mixing and mastering tools
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
