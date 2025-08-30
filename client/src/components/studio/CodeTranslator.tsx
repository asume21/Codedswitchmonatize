import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Code, Music, ArrowRight, Play } from "lucide-react";

export default function CodeTranslator() {
  const [sourceCode, setSourceCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    // Simulate translation process
    setTimeout(() => {
      setIsTranslating(false);
    }, 2000);
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-6 w-6" />
            Code to Music Translator
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="grid grid-cols-2 gap-6 h-full">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Programming Language
                </label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="cpp">C++</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  Source Code
                </label>
                <Textarea
                  placeholder="Paste your code here..."
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  className="h-64 font-mono text-sm"
                />
              </div>

              <Button 
                onClick={handleTranslate}
                disabled={!sourceCode || isTranslating}
                className="w-full"
              >
                {isTranslating ? (
                  "Translating..."
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Translate to Music
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                <h3 className="font-medium">Generated Music</h3>
              </div>

              <Card className="h-64 bg-gray-100 border-dashed border-2">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Music will appear here after translation</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button variant="outline" className="flex-1">
                  Export
                </Button>
              </div>

              <div className="text-xs text-gray-600">
                <p><strong>Translation Rules:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Functions become melodies</li>
                  <li>Loops create rhythmic patterns</li>
                  <li>Variables influence tempo</li>
                  <li>Comments add harmonies</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
