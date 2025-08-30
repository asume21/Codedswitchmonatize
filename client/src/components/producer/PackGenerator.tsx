import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Download, 
  Play, 
  Pause,
  RefreshCw,
  Music
} from "lucide-react";

interface SamplePack {
  id: string;
  name: string;
  genre: string;
  samples: number;
  size: string;
  preview?: string;
}

export default function PackGenerator() {
  const [selectedGenre, setSelectedGenre] = useState("electronic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPacks, setGeneratedPacks] = useState<SamplePack[]>([
    {
      id: "1",
      name: "Electronic Essentials",
      genre: "electronic",
      samples: 24,
      size: "45.2 MB"
    },
    {
      id: "2",
      name: "Hip Hop Beats",
      genre: "hip-hop",
      samples: 18,
      size: "32.1 MB"
    }
  ]);

  const genres = ["electronic", "hip-hop", "rock", "pop", "ambient", "techno", "house"];

  const generatePack = async () => {
    setIsGenerating(true);
    
    // Simulate pack generation
    setTimeout(() => {
      const newPack: SamplePack = {
        id: Date.now().toString(),
        name: `${selectedGenre.charAt(0).toUpperCase() + selectedGenre.slice(1)} Pack ${generatedPacks.length + 1}`,
        genre: selectedGenre,
        samples: Math.floor(Math.random() * 20) + 10,
        size: `${(Math.random() * 50 + 20).toFixed(1)} MB`
      };
      
      setGeneratedPacks(prev => [newPack, ...prev]);
      setIsGenerating(false);
    }, 3000);
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            Sample Pack Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Generation Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Genre</label>
                <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre.charAt(0).toUpperCase() + genre.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={generatePack}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating Pack...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Generate Sample Pack
                  </>
                )}
              </Button>
            </div>

            {/* Generated Packs */}
            <div>
              <h3 className="font-medium mb-4">Generated Packs</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {generatedPacks.map((pack) => (
                  <Card key={pack.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4" />
                            <span className="font-medium">{pack.name}</span>
                            <Badge variant="outline">{pack.genre}</Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {pack.samples} samples • {pack.size}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {generatedPacks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No packs generated yet</p>
                  <p className="text-sm">Generate your first sample pack above</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
