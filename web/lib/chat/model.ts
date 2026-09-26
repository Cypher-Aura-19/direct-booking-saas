// A thin, swappable interface around the LLM the guest-chat orchestrator
// drives (spec §5). Everything above `ChatModel` — the tool loop, the
// escalation rules, the reply scanner — is written against this interface,
// never against Gemini's HTTP shape, so it can be exercised in tests with
// `ScriptedModel` and never touch the real API (global constraint: "LLM
// behaviour is tested only through ScriptedModel").

export type ToolDeclaration = { name: string; description: string; parameters: Record<string, unknown> };

export type ModelMessage =
  | { role: "user" | "model"; text: string }
  | { role: "model"; toolCall: { name: string; args: unknown } }
  | { role: "tool"; name: string; result: unknown };

export type ModelTurn = { toolCall: { name: string; args: unknown } } | { error: string };

export interface ChatModel {
  next(system: string, history: ModelMessage[], tools: ToolDeclaration[]): Promise<ModelTurn>;
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: unknown } }
  | { functionResponse: { name: string; response: { result: unknown } } };

type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function toContents(history: ModelMessage[]): GeminiContent[] {
  return history.map((message) => {
    if ("toolCall" in message) {
      return { role: "model", parts: [{ functionCall: message.toolCall }] };
    }
    if (message.role === "tool") {
      return { role: "user", parts: [{ functionResponse: { name: message.name, response: { result: message.result } } }] };
    }
    return { role: message.role, parts: [{ text: message.text }] };
  });
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiModel implements ChatModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async next(system: string, history: ModelMessage[], tools: ToolDeclaration[]): Promise<ModelTurn> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const controller = new AbortController();

    // Raced against the request rather than relying solely on AbortController
    // aborting the fetch: a test (or a real network stack) may hand back a
    // promise that never resolves and never observes the abort signal.
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<ModelTurn>((resolve) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        resolve({ error: "Gemini request timed out." });
      }, this.timeoutMs);
    });

    const request = (async (): Promise<ModelTurn> => {
      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: toContents(history),
            tools: [{ functionDeclarations: tools }],
            toolConfig: { functionCallingConfig: { mode: "ANY" } },
            generationConfig: { temperature: 0.2 },
          }),
          signal: controller.signal,
        });
        if (!response.ok) return { error: `Gemini responded with HTTP ${response.status}.` };

        const data = await response.json();
        const part = data?.candidates?.[0]?.content?.parts?.[0];
        const functionCall = part?.functionCall;
        if (!functionCall || typeof functionCall.name !== "string") {
          return { error: "Gemini did not return a tool call." };
        }
        return { toolCall: { name: functionCall.name, args: functionCall.args ?? {} } };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Gemini request failed." };
      }
    })();

    try {
      return await Promise.race([request, timeout]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }
}

// Records every call so a test can assert on the exact system prompt and
// history a step in the orchestrator built, then plays back scripted turns —
// the only way model behaviour is exercised in tests (global constraint).
export class ScriptedModel implements ChatModel {
  calls: { system: string; history: ModelMessage[] }[] = [];
  private index = 0;

  constructor(private readonly turns: ModelTurn[]) {}

  async next(system: string, history: ModelMessage[]): Promise<ModelTurn> {
    this.calls.push({ system, history });
    if (this.index >= this.turns.length) return { error: "script exhausted" };
    return this.turns[this.index++];
  }
}

export function modelFromEnv(): ChatModel | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiModel({ apiKey });
}
