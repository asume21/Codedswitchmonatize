import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { makeAICall } from "./grok";

type ResponseFormat = "json" | "text";

export interface CallAIOptions<TSchema = Record<string, unknown>> {
  system?: string;
  user: string | ChatCompletionMessageParam[];
  temperature?: number;
  responseFormat?: ResponseFormat;
  /**
   * Optional JSON schema description. Currently embedded as guidance and,
   * where supported, passed through response_format.
   */
  jsonSchema?: TSchema;
  maxTokens?: number;
}

export interface CallAIResult<TContent = unknown> {
  content: TContent;
  raw: any;
  model?: string;
  provider?: "grok" | "openai" | string;
}

function buildMessages(options: CallAIOptions): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }

  if (Array.isArray(options.user)) {
    messages.push(...options.user);
  } else {
    messages.push({ role: "user", content: options.user });
  }

  // Add a lightweight schema reminder for providers that do not support json_schema yet.
  if (options.responseFormat === "json" && options.jsonSchema) {
    messages.push({
      role: "system",
      content: `Always return valid JSON that matches this schema: ${JSON.stringify(options.jsonSchema)}`,
    });
  }

  return messages;
}

export async function callAI<TContent = unknown>(options: CallAIOptions): Promise<CallAIResult<TContent>> {
  const messages = buildMessages(options);
  const wantsJson = options.responseFormat === "json";

  const responseFormat =
    wantsJson && options.jsonSchema
      ? {
          type: "json_schema",
          json_schema: {
            name: "response",
            schema: options.jsonSchema,
          },
        }
      : wantsJson
        ? { type: "json_object" }
        : undefined;

  let response;
  try {
    response = await makeAICall(messages, {
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 3000,
      response_format: responseFormat,
    });
  } catch (error) {
    // If structured schema fails (provider incompatibility), fall back to basic json_object.
    if (wantsJson && responseFormat && responseFormat.type === "json_schema") {
      response = await makeAICall(messages, {
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 3000,
        response_format: { type: "json_object" },
      });
    } else {
      throw error;
    }
  }

  const rawContent = response?.choices?.[0]?.message?.content ?? "";
  let parsed: any = rawContent;

  if (wantsJson) {
    try {
      parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch {
      // Leave parsed as rawContent so callers can decide how to handle malformed JSON.
    }
  }

  const model = response?.model;
  const provider = model?.includes("grok") ? "grok" : model?.includes("gpt") ? "openai" : undefined;

  return {
    content: parsed as TContent,
    raw: response,
    model,
    provider,
  };
}
