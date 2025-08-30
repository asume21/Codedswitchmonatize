import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mic, 
  Music, 
  Sparkles, 
  Play, 
  Pause, 
  Save,
  Download,
  RefreshCw
} from "lucide-react";

export default function LyricLab() {
  const [lyrics, setLyrics] = useState("");
  const [genre, setGenre] = useState("pop");
  const [mood, setMood] = useState("happy");
  const [theme, setTheme] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [rhymeScheme, setRhymeScheme] = useState("ABAB");

  const genres = ["pop", "rock", "hip-hop", "country", "r&b", "folk", "electronic"];
  const moods = ["happy", "sad", "energetic", "romantic", "melancholic", "uplifting", "dark"];
  const rhymeSchemes = ["ABAB", "AABB", "ABCB", "AAAA", "Free Verse"];

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      const sampleLyrics = `[Verse 1]
Walking down this empty street tonight
Stars are shining oh so bright
Dreams are calling from afar
Wish I may upon a star

[Chorus]
We can fly, we can soar
Open up that magic door
Nothing's gonna hold us down
We're the kings and queens of this town

[Verse 2]
Every step we take today
Leads us to a brighter way
Hand in hand we'll face the storm
Together we'll keep each other warm

[Chorus]
We can fly, we can soar
Open up that magic door
Nothing's gonna hold us down
We're the kings and queens of this town

[Bridge]
When the world gets heavy
And the road gets long
We'll remember this moment
We'll remember this song

[Outro]
Stars are shining oh so bright
Guiding us into the night`;
      
      setLyrics(sampleLyrics);
      setIsGenerating(false);
    }, 3000);
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-6 w-6" />
            Lyric Lab
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <Tabs defaultValue="write" className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="generate">AI Generate</TabsTrigger>
              <TabsTrigger value="analyze">Analyze</TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Mood</label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {moods.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Rhyme Scheme</label>
                  <Select value={rhymeScheme} onValueChange={setRhymeScheme}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rhymeSchemes.map((rs) => (
                        <SelectItem key={rs} value={rs}>{rs}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Lyrics</label>
                <Textarea
                  placeholder="Write your lyrics here..."
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="h-96 font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline">
                  <Play className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="generate" className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Theme/Topic</label>
                  <Textarea
                    placeholder="Describe what you want the song to be about..."
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="h-24"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={genre} onValueChange={setGenre}>
                        <SelectTrigger>
                          <SelectValue placeholder="Genre" />
                        </SelectTrigger>
                        <SelectContent>
                          {genres.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={mood} onValueChange={setMood}>
                        <SelectTrigger>
                          <SelectValue placeholder="Mood" />
                        </SelectTrigger>
                        <SelectContent>
                          {moods.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating Lyrics...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Lyrics
                  </>
                )}
              </Button>

              {lyrics && (
                <div className="mt-6">
                  <label className="text-sm font-medium mb-2 block">Generated Lyrics</label>
                  <Textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="h-64 font-mono text-sm"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="analyze" className="mt-6">
              {!lyrics ? (
                <div className="text-center py-12 text-gray-500">
                  <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Write or generate lyrics to see analysis</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">24</div>
                        <p className="text-sm text-gray-600">Lines</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">156</div>
                        <p className="text-sm text-gray-600">Words</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">4</div>
                        <p className="text-sm text-gray-600">Verses</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Structure Analysis</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Verse 1</Badge>
                      <Badge variant="outline">Chorus</Badge>
                      <Badge variant="outline">Verse 2</Badge>
                      <Badge variant="outline">Chorus</Badge>
                      <Badge variant="outline">Bridge</Badge>
                      <Badge variant="outline">Outro</Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Rhyme Analysis</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Detected rhyme scheme: <Badge variant="secondary">ABAB</Badge>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Rhyme quality: <Badge variant="secondary">Good</Badge>
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Sentiment Analysis</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Positive</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: "75%"}}></div>
                        </div>
                        <span className="text-sm">75%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Neutral</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{width: "20%"}}></div>
                        </div>
                        <span className="text-sm">20%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Negative</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{width: "5%"}}></div>
                        </div>
                        <span className="text-sm">5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
