import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";

export default function CodeTranslator() {
  const [sourceLanguage, setSourceLanguage] = useState("javascript");
  const [targetLanguage, setTargetLanguage] = useState("python");
  const [aiProvider, setAiProvider] = useState("grok");
  const [sourceCode, setSourceCode] = useState(`function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Generate first 10 fibonacci numbers
for (let i = 0; i < 10; i++) {
    console.log(fibonacci(i));
}`);
  const [translatedCode, setTranslatedCode] = useState("");

  const { toast } = useToast();

  const translateMutation = useMutation({
    mutationFn: async (data: { sourceCode: string; sourceLanguage: string; targetLanguage: string; aiProvider: string }) => {
      const response = await apiRequest("POST", "/api/ai/translate-code", data);
      return response.json();
    },
    onSuccess: (data) => {
      setTranslatedCode(data.translatedCode);
      toast({
        title: "Translation Complete",
        description: "Code has been successfully translated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Translation Failed",
        description: "Failed to translate code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTranslate = () => {
    if (!sourceCode.trim()) {
      toast({
        title: "No Code Provided",
        description: "Please enter some code to translate.",
        variant: "destructive",
      });
      return;
    }

    translateMutation.mutate({
      sourceCode,
      sourceLanguage,
      targetLanguage,
      aiProvider,
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(translatedCode);
    toast({
      title: "Copied to Clipboard",
      description: "Translated code has been copied to clipboard.",
    });
  };

  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "csharp", label: "C#" },
  ];

  return (
    <div className="h-full p-6 flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">AI Code Translator</h2>
        <div className="flex items-center space-x-4">
          <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
          <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <i className="fas fa-arrow-right text-studio-accent"></i>
          
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={handleTranslate}
            disabled={translateMutation.isPending}
            className="bg-studio-accent hover:bg-blue-500"
          >
            {translateMutation.isPending ? (
              <>
                <i className="fas fa-spinner animate-spin mr-2"></i>
                Translating...
              </>
            ) : (
              <>
                <i className="fas fa-magic mr-2"></i>
                Translate
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-2 gap-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Source Code</h3>
            <span className="text-sm text-gray-400 capitalize">{sourceLanguage}</span>
          </div>
          <Textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            className="flex-1 bg-studio-panel border-gray-600 font-mono text-sm resize-none"
            placeholder="Enter your source code here..."
          />
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Translated Code</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400 capitalize">{targetLanguage}</span>
              {translatedCode && (
                <Button
                  onClick={copyToClipboard}
                  variant="ghost"
                  size="sm"
                  className="text-studio-accent hover:text-blue-300"
                >
                  <i className="fas fa-copy mr-1"></i>Copy
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 bg-studio-panel border border-gray-600 rounded-lg p-4">
            <pre className="font-mono text-sm whitespace-pre-wrap h-full overflow-auto">
              {translatedCode || "Translated code will appear here..."}
            </pre>
          </div>
        </div>
      </div>
      
      <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          {translateMutation.isSuccess ? (
            <>
              <div className="w-2 h-2 bg-studio-success rounded-full"></div>
              <span className="text-sm">Translation completed successfully with high accuracy</span>
            </>
          ) : translateMutation.isPending ? (
            <>
              <div className="w-2 h-2 bg-studio-warning rounded-full animate-pulse"></div>
              <span className="text-sm">Translating code using AI...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span className="text-sm">Ready to translate code</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
