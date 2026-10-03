import OpenAI from "openai";
import type {
  ContentBlock,
  Message,
  Provider,
  StopReason,
  TextBlock,
  ToolCallBlock,
  Usage,
} from "../types.ts";

// mirrors the Anthropic provider: each Message variant maps to a different
// OpenAI role, and "toolResult" is renamed to "tool" with the id carried in
// tool_call_id. isError has no field on the OpenAI side and is dropped.
function toChat(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.ChatCompletionMessageParam => {
    if (m.role === "user") return { role: "user", content: m.content };

    if (m.role === "assistant") {
      const text = m.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const toolCalls = m.content
        .filter((b): b is ToolCallBlock => b.type === "toolCall")
        .map((b) => ({
          id: b.id,
          type: "function" as const,
          function: { name: b.name, arguments: JSON.stringify(b.arguments) },
        }));
      return {
        role: "assistant",
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      };
    }

    return {
      role: "tool",
      tool_call_id: m.toolCallId,
      content: m.content,
    };
  });
}


export function createOpenAICompatible(
  name: string,
  baseURL: string,
  apiKey: string,
  defaultModel: string,
): Provider {
  const client = new OpenAI({ baseURL, apiKey });
  return {
    name,
    defaultModel,
    async *stream({ messages, model, system, tools=[] }) {
      const chat = toChat(messages);
      const stream = await client.chat.completions.create({
        model,
        stream: true,
        stream_options: { include_usage: true },
        tools: tools.length ? tools.map((t) => ({
          type: "function" as const, function: {
            name: t.name, description: t.description, parameters: t.parameters
          },
        })) : undefined,
        messages: system
          ? [{ role: "system", content: system }, ...chat]
          : chat,
      });
      let text = "";
      let usage: Usage = { input: 0, output: 0 };
      let stopReason: StopReason = "stop";
      const calls: {id: string, name: string, args: string}[] = [];
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta.content) {
          text += choice.delta.content;
          yield { type: "text_delta", delta: choice.delta.content };
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          // the first piece of call brings id + name, later pieces only bring more arguments
          calls[tc.index] ??= {id: tc.id ?? `call_${tc.index}`, name: tc.function?.name ?? "", args: ""};
          calls[tc.index].args += tc.function?.arguments ?? "";
        }
        if (choice?.finish_reason === "tool_calls") stopReason = "toolUse";
        else if (choice?.finish_reason === "length") stopReason = "length";
        if (chunk.usage) {
          usage = {
            input: chunk.usage.prompt_tokens,
            output: chunk.usage.completion_tokens,
          };
        }
      }
      const content: ContentBlock[] = text ? [{type:"text", text}] : [];
      for (const c of calls) {
        if(c) content.push({type: "toolCall", id: c.id, name: c.name, arguments: c.args ? JSON.parse(c.args) : []});
      }
      if(content.some((b) => b.type === "toolCall")) stopReason = "toolUse";

      yield {
        type: "done",
        message: { role: "assistant", content, usage, stopReason },
      };
    },
  };
}
