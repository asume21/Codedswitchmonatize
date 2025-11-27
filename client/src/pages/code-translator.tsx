import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function CodeTranslatorPage() {
  return (
    <div className="p-6 space-y-4" data-testid="code-translator">
      <Card>
        <CardHeader>
          <CardTitle>Code Translator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Source Language</label>
              <Select defaultValue="javascript">
                <SelectTrigger data-testid="source-language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Target Language</label>
              <Select defaultValue="python">
                <SelectTrigger data-testid="target-language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Code</label>
            <Textarea className="min-h-[160px] code-editor" placeholder="Paste your code here" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Translated Code</label>
            <Textarea className="min-h-[160px]" placeholder="Translation will appear here" readOnly />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
