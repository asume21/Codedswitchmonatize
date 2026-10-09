import AstutelyChatbot from "@/components/ai/AstutelyChatbot";

// One assistant everywhere: Astutely (it used to be a separate, weaker
// AIAssistant with its own backend — product review A6).
export default function AIAssistantPage() {
  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <AstutelyChatbot embedded />
    </div>
  );
}
