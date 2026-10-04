import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProvider } from "./index.ts";
import type { Message, AssistantMessage } from "./types.ts";
import { runAgent } from "./agent/loop.ts";
import { tools } from "./tools/index.ts";
// load the .env next to the code, so mypi works from any folder
config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
//const tools = [readTool];

const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "p" },
    provider: { type: "string", default: "groq" },
    model: { type: "string" },
  },
});

if (!values.prompt) {
  console.error(
    'no prompt string provided, mypi -p "prompt" --provider anthropic OR groq',
  );
  process.exit(1);
}

const provider = getProvider(values.provider);
const model = values.model ?? provider.defaultModel;
const messages: Message[] = [{ role: "user", content: values.prompt }];

await runAgent({
  provider,
  model,
  tools,
  messages,
  onEvent(event) {
    if (event.type === "text") process.stdout.write(event.delta);
    else if (event.type === "tool_start") console.log(`\n ${event.call.name}`);
    else if (event.type === "tool_end") {
      const lines = event.result.split("\n").length;
      console.log(`\n ${event.isError ? event.result : lines}`);
    } else if (event.type === "turn_end") {
      const { usage, stopReason } = event.message;
      console.log(
        `\n\n ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`,
      );
    }
  },
});

async function callModel(): Promise<AssistantMessage> {
  for await (const event of provider.stream({ messages, model, tools })) {
    if (event.type === "text_delta") process.stdout.write(event.delta);
    else {
      const { usage, stopReason } = event.message;

      console.log(
        `\n\n ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`,
      );
      return event.message;
    }
  }
  throw new Error("stream ended without a done event");
}

/*const first = await callModel();
messages.push(first);

if (first.stopReason === "toolUse") {
  for (const block of first.content) {
    if (block.type !== "toolCall") continue;
    console.log(`-> ${block.name}(${JSON.stringify(block.arguments)})`);
    const result = await readTool.execute(block.arguments);
    messages.push({
      role: "toolResult",
      toolCallId: block.id,
      toolName: block.name,
      content: result,
      isError: false,
    });
  }
  // round 2: the model sees the tool result and answers.
  messages.push(await callModel());
}*/

/*for await (const event of provider.stream({ messages, model })) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
  else {
    const { usage, stopReason } = event.message;
    console.log(
      `\n\n ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`,
    );
  }
}*/

/*const client = new Anthropic();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const response = await groq.chat.completions.create({
    model: values.model,
    messages: [{ role: "user", content: values.prompt }],
    max_tokens: 2000,
    temperature: 0.7,
});
console.log(response.choices[0].message);*/
