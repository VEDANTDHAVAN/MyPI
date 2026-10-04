# mypi

A small, provider-agnostic coding agent CLI. `mypi` streams a prompt to an LLM, lets it call filesystem and shell tools, feeds the results back, and repeats until the model stops asking for tools.

Everything is written in TypeScript and runs directly via `tsx` — no build step.

---

## Table of contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Providers](#providers)
- [Environment variables](#environment-variables)
- [Available tools](#available-tools)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Adding a provider](#adding-a-provider)
- [Adding a tool](#adding-a-tool)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [License](#license)

---

## What it does

Given a prompt, the CLI runs an agent loop:

1. Streams the conversation to the selected provider.
2. Prints text deltas as they arrive.
3. If the model requests tool calls, executes them, appends the results to the conversation.
4. Repeats until the model returns without tool calls, or a turn limit is hit.

```
mypi -p "how many tools do you have?"
```

---

## Requirements

- **Node.js 20+** (uses `parseArgs` from `node:util`, top-level `await`, ESM)
- **npm**
- A key for at least one provider (see [Environment variables](#environment-variables))
- On Windows, **Git Bash** for the `bash` tool — see [Available tools](#available-tools)

---

## Setup

```bash
git clone <your-repo-url>
cd agent-harness
npm install
```

Create a `.env` in the project root:

```env
GROQ_API_KEY=gsk_...
AI_GATEWAY_API_KEY=vck_...
POE_API_KEY=sk-...
```

`.env` is gitignored (`.gitignore:2`), so it stays local. The CLI loads it relative to the module, not your shell's working directory — `src/main.ts:9-12` resolves `../.env` from `import.meta.url`, so `mypi` works from any folder.

Then link the CLI so `mypi` resolves as a command:

```bash
npm link
```

That creates a shim in your global npm bin directory (`%APPDATA%\npm` on Windows, `~/.npm-global/bin` on macOS/Linux). Without it you get `mypi: command not found`, since the bin is declared in `package.json:25-27` but npm does not link a package's own bins into its local `node_modules/.bin`.

**Check the install:**

```bash
mypi -p "say hello"
```

---

## Usage

```
mypi -p "<prompt>" [--provider <name>] [--model <id>]
```

| Flag | Short | Default | Description |
|---|---|---|---|
| `--prompt` | `-p` | — | Required. The user prompt. |
| `--provider` | | `groq` | Which provider to use (see below). |
| `--model` | | provider default | Override the model id. |

Examples:

```bash
# default provider (groq)
mypi -p "list the files in this folder"

# a specific provider
mypi -p "what is in tsconfig.json" --provider vercel-openai

# override the model on any provider
mypi -p "summarise README.md" --provider anthropic --model claude-opus-5

# let it actually use the filesystem
mypi -p "create a file called notes.txt containing hello" --provider groq
```

Without `npm link`, run it directly:

```bash
npm run dev -- -p "your prompt"
# or
npx tsx src/main.ts -p "your prompt"
```

---

## Providers

Defined in `src/index.ts:5-35`. Three of the five are OpenAI-compatible and share one adapter (`src/providers/openai-compat.ts`); Anthropic has its own.

| Name | Adapter | Base URL | Env var | Default model |
|---|---|---|---|---|
| `groq` | OpenAI-compatible | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | `qwen/qwen3.8-27b` |
| `vercel-openai` | OpenAI-compatible | `https://ai-gateway.vercel.sh/v1` | `AI_GATEWAY_API_KEY` | `openai/gpt-5.4-nano` |
| `vercel-gemini` | OpenAI-compatible | `https://ai-gateway.vercel.sh/v1` | `AI_GATEWAY_API_KEY` | `google/gemini-2.5-flash` |
| `vercel-kimi` | OpenAI-compatible | `https://ai-gateway.vercel.sh/v1` | `AI_GATEWAY_API_KEY` | `moonshotai/kimi-k2.7-code` |
| `anthropic` | Anthropic SDK | — | `ANTHROPIC_API_KEY` | `claude-sonnet-5.5` |
| `anthropic-openai` | OpenAI-compatible | `https://api.anthropic.com/v1` | `POE_API_KEY` | `claude-sonnet-5` |

`vercel-openai`, `vercel-gemini` and `vercel-kimi` all route through Vercel's AI Gateway, so one key covers all three.

Passing an unknown provider throws `Something is wrong in index.ts` (`src/index.ts:39-41`) — that message is unhelpful by design-by-accident; see [Known limitations](#known-limitations).

---

## Environment variables

| Variable | Used by |
|---|---|
| `GROQ_API_KEY` | `groq` |
| `AI_GATEWAY_API_KEY` | `vercel-openai`, `vercel-gemini`, `vercel-kimi` |
| `POE_API_KEY` | `anthropic-openai` |
| `ANTHROPIC_API_KEY` | `anthropic` |

All are read with `process.env.X!` — a non-null assertion. If the key is missing you get an SDK-level error like `Could not resolve authentication method` rather than a friendly message.

---

## Available tools

The model can call any of these. They're registered in `src/tools/index.ts:13-24` and passed to the provider on every turn.

| Tool | File | What it does |
|---|---|---|
| `read` | `src/tools/read.ts` | Reads a text file. |
| `write` | `src/tools/write.ts` | Writes a file, creating parent dirs. |
| `edit` | `src/tools/edit.ts` | Replaces an exact string, first occurrence or all. |
| `delete` | `src/tools/delete.ts` | Deletes a file or directory (`recursive` for dirs). |
| `list` | `src/tools/list.ts` | Lists files/dirs with size and mtime, optionally recursive. |
| `stats` | `src/tools/stats.ts` | File metadata: type, size, mode, timestamps. |
| `find` | `src/tools/find.ts` | Finds files by name — exact, substring, or glob. |
| `search` | `src/tools/search.ts` | Searches file contents, literal or regex, with glob filter. |
| `grep` | `src/tools/grep.ts` | Content search with line numbers and context. |
| `bash` | `src/tools/bash.ts` | Runs a shell command. |

Shared helpers live in `src/tools/utils.ts`: `escapeRegExp`, `globToRegex`, and an async `walk` generator that skips dot-directories and respects an exclusion set.

Every tool resolves relative paths against `process.cwd()`, so the model's view of the filesystem is anchored to wherever you invoked the CLI.

**Tool output limits** (`src/tools/bash.ts:28-40`): shell output is capped at 2000 lines / 50KB and truncated from the *end*, so the useful part of a long log survives. Search and grep cap at 200 and 100 results respectively.

**Bash on Windows**: `findBash()` (`src/tools/bash.ts:10-26`) deliberately avoids `bash` on `PATH`, which on Windows is often the WSL launcher in `System32` — and WSL sees a different filesystem, so paths wouldn't resolve. It looks for Git Bash at the usual install paths, then scans `PATH` while skipping `System32`. Timeouts kill the whole process tree with `taskkill /T`, since `child.kill()` leaves grandchildren running.

---

## How it works

### The type layer (`src/types.ts`)

The core is a small set of provider-neutral types:

- **`Message`** — a discriminated union of `UserMessage`, `AssistantMessage`, `ToolResultMessage`.
- **`ContentBlock`** — `TextBlock | ToolCallBlock`. Assistant content is an array of these, not a string.
- **`Tool`** — a JSON-schema `parameters` object plus an async `execute(args)` that returns a string.
- **`StreamEvent`** — `text_delta` or `done`.
- **`Provider`** — `{ name, defaultModel, stream(opts) }`.

The union is the whole point: the agent loop never imports an SDK. It only knows `Message` and `StreamEvent`.

### The loop (`src/agent/loop.ts`)

`runAgent` is deliberately small:

```ts
for (let turn = 1; turn <= maxTurns; ++turn) {
  // stream, collect the assistant message
  // append it
  // if stopReason !== "toolUse", return
  // otherwise execute every toolCall and append a toolResult for each
}
throw new Error(`Stopped after ${maxTurns} end.`);
```

Max turns defaults to 20 (`src/agent/loop.ts:28`). Tool execution errors are caught and turned into `toolResult` messages with `isError: true`, so a failing tool feeds an error back to the model instead of crashing the run.

One thing worth knowing: unknown tool names throw inside the try, but the message interpolates the `tool` variable rather than `call.name` (`src/agent/loop.ts:53`) — so it prints `unknown tool name undefined` rather than the name that failed. The model gets a useless error. See [Known limitations](#known-limitations).

### Streaming and translation

Both providers implement `stream()` as an async generator, yielding `text_delta` events and exactly one `done` event.

**Anthropic** (`src/providers/anthropic.ts`) uses the SDK's `messages.stream()`. Tool-call arguments arrive as `input_json_delta` fragments, so it accumulates `partial_json` into a string and `JSON.parse`s it at `content_block_stop`. Tool results are sent as a *user* message containing `tool_result` blocks, which is how the Anthropic API models tool output.

**OpenAI-compatible** (`src/providers/openai-compat.ts`) accumulates `tool_calls` across chunks by index. Tool-call arguments are likewise reassembled from string fragments. Tool results become `{ role: "tool", tool_call_id, content }`.

Both providers need a translation function because the internal `Message` union doesn't match either API's schema:

| Internal | Anthropic | OpenAI |
|---|---|---|
| `{ role: "user", content: string }` | `{ role: "user", content }` | `{ role: "user", content }` |
| `{ role: "assistant", content: ContentBlock[] }` | `content: [TextBlock \| ToolUseBlock]` | `content: string \| null` + `tool_calls: [...]` |
| `{ role: "toolResult", ... }` | `{ role: "user", content: [tool_result] }` | `{ role: "tool", tool_call_id, content }` |

Note that internal assistant content is a *block array*, while OpenAI's is a flat string plus a separate `tool_calls` array. The translation flattens text blocks into one string and moves tool calls into `tool_calls`.

### The CLI (`src/main.ts`)

Parses args, resolves the provider, seeds `messages` with the user prompt, and hands off to `runAgent` with an `onEvent` callback that renders events to stdout: text written directly, tool calls printed with a line count, and a per-turn usage summary.

---

## Project layout

```
agent-harness/
├── bin/
│   └── mypi.js            # launcher: registers tsx, imports src/main.ts
├── scripts/
│   └── test-tools.ts      # exercise every tool against a temp dir
├── src/
│   ├── main.ts            # CLI entry: arg parsing + output rendering
│   ├── index.ts           # provider registry
│   ├── types.ts           # provider-neutral message/tool/event types
│   ├── agent/
│   │   └── loop.ts        # runAgent: the tool-calling loop
│   ├── providers/
│   │   ├── anthropic.ts   # Anthropic Messages API adapter
│   │   └── openai-compat.ts # any OpenAI-compatible endpoint
│   └── tools/
│       ├── index.ts       # registry: the array of enabled tools
│       ├── utils.ts       # escapeRegExp, globToRegex, walk
│       ├── read.ts write.ts edit.ts delete.ts
│       ├── list.ts stats.ts
│       ├── find.ts search.ts grep.ts
│       └── bash.ts
├── package.json
├── tsconfig.json
└── .gitattributes
```

`.gitattributes` pins `* text=auto eol=lf` so line endings stay LF across platforms — worth keeping, since a stray CRLF can silently change string literals in tool arguments and break exact-match edits.

---

## Adding a provider

Add an entry to the registry in `src/index.ts`. For anything OpenAI-compatible, one line:

```ts
myprovider: () =>
  createOpenAICompatible(
    "myprovider",              // display name, printed in the summary
    "https://api.example.com/v1",
    process.env.MY_API_KEY!,
    "some-model-id",           // default model
  ),
```

For a non-OpenAI API, implement the `Provider` interface yourself:

```ts
import type { AssistantMessage, ContentBlock, Provider, StreamEvent, Usage } from "../types.ts";

export function createMyProvider(): Provider {
  return {
    name: "myprovider",
    defaultModel: "some-model-id",
    async *stream({ messages, model, system, tools }): AsyncIterable<StreamEvent> {
      // yield { type: "text_delta", delta } ...
      // yield { type: "done", message } exactly once
    },
  };
}
```

The contract: yield zero or more `text_delta`, then exactly one `done` carrying the full assistant message with `content`, `usage` and `stopReason`. The loop depends on `done` arriving — `src/agent/loop.ts:40` throws `Assistant is Empty!` if the stream ends without one.

---

## Adding a tool

A tool is a plain object satisfying `Tool` (`src/types.ts:35-37`):

```ts
import { Tool } from "../types.ts";

export const myTool: Tool = {
  name: "mytool",
  description: "One line on what it does — the model reads this to decide when to call it.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "..." },
    },
    required: ["path"],
  },
  async execute(args) {
    // args is Record<string, unknown> — coerce every field
    return "the string result the model will see";
  },
};
```

Then add it to the array in `src/tools/index.ts`. That's the whole wiring — the agent loop finds tools by name and the providers serialise `parameters` into whatever schema their API expects.

Two conventions worth following:

- **Return errors, don't throw.** Most tools catch and return `Error: ${e.message}` so the model can read the problem and retry. The loop handles thrown errors too, but a returned string round-trips more cleanly.
- **Resolve paths against `process.cwd()`** so the model's paths mean the same thing yours do.

---

## Testing

```bash
npm test        # runs scripts/test-tools.ts
npm run dev     # runs src/main.ts, pass flags with --
```

`npm test` doesn't use a test framework — it's a script that exercises every tool against `scripts/.tmp-test/` and prints the results, including error paths (missing files, regex special characters, timeouts). It cleans up after itself. Useful for eyeballing tool behaviour; it makes no assertions, so it won't fail CI on a regression.

Type checking is separate:

```bash
npx tsc --noEmit
```

---

## Security notes

The tools run with your full OS permissions, in your working directory, and `bash` executes arbitrary commands. `delete` takes a `recursive` flag and will remove directories. Treat any prompt you pass to `mypy` as potentially destructive — the model can delete files, and only your judgement about what you asked for stands between it and your filesystem.

`.env` is gitignored. Don't commit API keys.

---

## Known limitations

Places the code knows is rough, listed so you don't have to rediscover them:

- **`src/agent/loop.ts:53`** — the unknown-tool error interpolates `tool` (undefined at that point) instead of `call.name`, producing `unknown tool name undefined`. The model can't tell which tool failed.
- **`src/agent/loop.ts:63`** — `Stopped after ${maxTurns} end.` reads as truncated; should be `turns`.
- **`src/agent/loop.ts:45-61`** — tool calls in a single assistant message are executed **sequentially**, in content order. Parallel tool calls aren't supported, even though both APIs support them.
- **`src/index.ts:39-41`** — unknown provider throws `Something is wrong in index.ts`, which tells the user nothing. Should name the valid options.
- **`src/main.ts:54-110`** — ~55 lines of commented-out earlier iterations of the loop sit below the live code. Dead weight; worth deleting once you're happy with `runAgent`.
- **`package.json:5`** — `main` points at `index.js`, which doesn't exist.
- **No tests for the agent loop or providers** — only the tools are exercised. The two translation functions are the most likely place for a subtle bug and have no coverage.

---

## License

ISC, per `package.json:12`.