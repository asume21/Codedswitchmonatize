/**
 * Astutely Orchestrator
 * 
 * USER-FIRST DESIGN: Parses user intent and SUGGESTS actions for approval.
 * 
 * Flow:
 * 1. User sends message to Astutely
 * 2. Orchestrator analyzes intent
 * 3. Orchestrator SUGGESTS tool calls (doesn't auto-execute)
 * 4. Frontend shows suggestions with [Accept] [Modify] [Cancel] buttons
 * 5. User approves → Frontend executes the action
 */

import { makeAICall } from '../../services/grok';
import { makeLocalAICall } from '../../services/localAI';
import { 
  ASTUTELY_TOOLS, 
  executeTool, 
  getToolDescriptionsForAI,
  ToolResult,
  ToolContext,
  ProjectState,
  SuggestedAction
} from '../tools/astutelyTools';
import { randomUUID } from 'crypto';

export interface OrchestratorRequest {
  message: string;
  projectState: ProjectState;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId?: string;
  sessionId?: string;
}

export interface OrchestratorResponse {
  message: string;                    // AI's response to user
  suggestedActions: SuggestedAction[]; // Actions for user to approve
  quickActions: ToolResult[];          // Safe actions that executed immediately (play/stop)
  success: boolean;
}

// Quick commands that are safe to execute immediately (non-destructive, easily reversible)
const QUICK_COMMANDS: Record<string, { action: string; message: string }> = {
  'play': { action: 'TRANSPORT_PLAY', message: 'Playing!' },
  'start': { action: 'TRANSPORT_PLAY', message: 'Playing!' },
  'stop': { action: 'TRANSPORT_STOP', message: 'Stopped.' },
  'pause': { action: 'TRANSPORT_PAUSE', message: 'Paused.' },
  'status': { action: 'GET_STATUS', message: 'Here\'s the current status:' },
};

// System prompt that teaches Astutely how to suggest tools
function buildSystemPrompt(): string {
  return `You are Astutely, the AI assistant for CodedSwitch DAW. You help users make music.

IMPORTANT: You SUGGEST actions, you don't execute them. The user will approve or reject your suggestions.

${getToolDescriptionsForAI()}

RESPONSE FORMAT - Always respond with valid JSON:
{
  "message": "Your friendly response explaining what you're suggesting",
  "suggestions": [
    { 
      "tool": "tool_name", 
      "params": { "param1": "value1" },
      "description": "Human-readable description of what this will do"
    }
  ]
}

EXAMPLES:

User: "set the bpm to 140"
Response: {
  "message": "I'll set the tempo to 140 BPM for you.",
  "suggestions": [{"tool": "set_bpm", "params": {"bpm": 140}, "description": "Set tempo to 140 BPM"}]
}

User: "make a trap beat"
Response: {
  "message": "I'll generate a trap beat with hard-hitting 808s and rolling hi-hats.",
  "suggestions": [{"tool": "generate_beat", "params": {"style": "trap"}, "description": "Generate a trap beat pattern"}]
}

User: "add a C major chord"
Response: {
  "message": "I'll add a C major chord (C-E-G) at the beginning of the track.",
  "suggestions": [{"tool": "add_chord", "params": {"pitches": [60, 64, 67], "start": 0, "duration": 16}, "description": "Add C major chord at step 0"}]
}

User: "mute the drums and turn up the bass"
Response: {
  "message": "I'll mute the drums and increase the bass volume.",
  "suggestions": [
    {"tool": "mute_track", "params": {"trackId": "drums", "muted": true}, "description": "Mute drums track"},
    {"tool": "set_volume", "params": {"trackId": "bass", "volume": 80}, "description": "Set bass volume to 80%"}
  ]
}

User: "how do I make my beats better?"
Response: {
  "message": "Here are some tips for better beats:\n\n1. **Layer your drums** - Use multiple kick and snare samples\n2. **Add swing** - 10-20% swing makes beats feel more human\n3. **Use sidechain compression** - Duck other elements when the kick hits\n4. **Leave space** - Don't fill every beat, silence is powerful\n\nWant me to help you apply any of these?",
  "suggestions": []
}

RULES:
- Always respond with valid JSON
- Use suggestions when user wants to DO something
- Empty suggestions array for questions/advice (just give helpful text)
- Keep descriptions short and clear
- Be friendly and helpful`;
}

/**
 * Parse AI response to extract suggestions
 */
function parseAIResponse(response: string): { 
  message: string; 
  suggestions: Array<{ tool: string; params: any; description: string }> 
} {
  try {
    const parsed = JSON.parse(response);
    return {
      message: parsed.message || "Here's what I suggest:",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    };
  } catch {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          message: parsed.message || "Here's what I suggest:",
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
        };
      } catch {
        // Fall through
      }
    }
    // No JSON found - treat as plain message
    return { message: response, suggestions: [] };
  }
}

/**
 * Check if message is a quick command
 */
function checkQuickCommand(message: string): { isQuick: boolean; result?: ToolResult; response?: string } {
  const lower = message.toLowerCase().trim();
  
  // Direct quick commands
  if (QUICK_COMMANDS[lower]) {
    const cmd = QUICK_COMMANDS[lower];
    return {
      isQuick: true,
      result: { success: true, action: cmd.action, message: cmd.message },
      response: cmd.message
    };
  }
  
  // BPM quick set (common enough to be quick)
  const bpmMatch = lower.match(/^(?:set\s+)?bpm\s+(?:to\s+)?(\d+)$|^(\d+)\s*bpm$/);
  if (bpmMatch) {
    const bpm = parseInt(bpmMatch[1] || bpmMatch[2]);
    if (bpm >= 20 && bpm <= 300) {
      return {
        isQuick: true,
        result: { success: true, action: 'SET_BPM', data: { bpm }, message: `BPM set to ${bpm}` },
        response: `BPM set to ${bpm}`
      };
    }
  }
  
  return { isQuick: false };
}

/**
 * Main orchestrator function
 */
export async function orchestrateRequest(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const { message, projectState, conversationHistory = [], userId, sessionId } = request;
  
  console.log(`🧠 Astutely: "${message.substring(0, 50)}..."`);
  
  // Check for quick commands first (no AI needed)
  const quickCheck = checkQuickCommand(message);
  if (quickCheck.isQuick && quickCheck.result) {
    console.log(`⚡ Quick command: ${quickCheck.result.action}`);
    return {
      message: quickCheck.response || 'Done!',
      suggestedActions: [],
      quickActions: [quickCheck.result],
      success: true
    };
  }
  
  // Build messages for AI
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt() },
    { 
      role: 'system' as const, 
      content: `CURRENT PROJECT:
- BPM: ${projectState.bpm}
- Key: ${projectState.key}
- Playing: ${projectState.isPlaying ? 'Yes' : 'No'}
- Tracks: ${projectState.tracks.map(t => `${t.name} (${t.type})`).join(', ') || 'none'}
- Selected: ${projectState.selectedTrackId || 'none'}`
    },
    ...conversationHistory.slice(-6),
    { role: 'user' as const, content: message }
  ];
  
  let aiResponse: string;
  
  // Try local AI first, fall back to cloud
  try {
    console.log('🖥️ Trying local AI...');
    const localResponse = await makeLocalAICall(messages, { format: 'json', temperature: 0.7 });
    aiResponse = localResponse.choices[0]?.message?.content || '';
    console.log('✅ Local AI responded');
  } catch (localError) {
    console.log('☁️ Falling back to Grok...');
    try {
      const cloudResponse = await makeAICall(messages, { 
        response_format: { type: 'json_object' },
        temperature: 0.7 
      });
      aiResponse = cloudResponse.choices[0]?.message?.content || '';
      console.log('✅ Grok responded');
    } catch (cloudError) {
      console.error('❌ AI failed:', cloudError);
      return {
        message: "I'm having trouble right now. Try a simple command like 'play', 'stop', or 'make a beat'.",
        suggestedActions: [],
        quickActions: [],
        success: false
      };
    }
  }
  
  // Parse response
  const parsed = parseAIResponse(aiResponse);
  console.log(`💡 Suggestions: ${parsed.suggestions.length}`);
  
  // Convert suggestions to SuggestedAction format
  const suggestedActions: SuggestedAction[] = parsed.suggestions.map(s => ({
    id: randomUUID(),
    toolName: s.tool,
    description: s.description || `Execute ${s.tool}`,
    params: s.params || {},
    status: 'pending' as const
  }));
  
  return {
    message: parsed.message,
    suggestedActions,
    quickActions: [],
    success: true
  };
}

/**
 * Execute an approved action
 */
export async function executeApprovedAction(
  action: SuggestedAction,
  projectState: ProjectState
): Promise<ToolResult> {
  console.log(`✅ Executing approved action: ${action.toolName}`);
  
  const context: ToolContext = { projectState };
  return executeTool(action.toolName, action.params, context);
}
