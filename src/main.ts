import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { parseArgs } from "node:util";
import { getProvider } from "./index.ts";
import { Message } from "./types.ts";

// load the .env next to the code, so mypi works from any folder
config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

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

for await (const event of provider.stream({ messages, model })) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
  else {
    const { usage, stopReason } = event.message;
    console.log(
      `\n\n ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`,
    );
  }
}
/*const client = new Anthropic();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const response = await groq.chat.completions.create({
    model: values.model,
    messages: [{ role: "user", content: values.prompt }],
    max_tokens: 2000,
    temperature: 0.7,
});
console.log(response.choices[0].message);*/
