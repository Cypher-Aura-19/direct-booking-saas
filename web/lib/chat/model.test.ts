// @vitest-environment node
import { describe, expect, test } from "vitest";
import { GeminiModel, ScriptedModel, modelFromEnv, type ChatModel, type ModelMessage, type ToolDeclaration } from "./model";

const TOOLS: ToolDeclaration[] = [{ name: "check_stay", description: "d", parameters: { type: "object", properties: {} } }];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("GeminiModel", () => {
  test("builds the request URL, headers and body, mapping all four history kinds", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      captured = { url: String(url), init: init! };
      return jsonResponse({
        candidates: [{ content: { parts: [{ functionCall: { name: "respond", args: { reply: "hi", escalate: false } } }] } }],
      });
    }) as typeof fetch;

    const model = new GeminiModel({ apiKey: "test-key", model: "gemini-test", fetchImpl });
    const history: ModelMessage[] = [
      { role: "user", text: "hello" },
      { role: "model", text: "hi there" },
      { role: "model", toolCall: { name: "check_stay", args: { check_in: "2026-10-10", check_out: "2026-10-12" } } },
      { role: "tool", name: "check_stay", result: { ok: true } },
    ];

    await model.next("system prompt", history, TOOLS);

    expect(captured).not.toBeNull();
    expect(captured!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");

    const headers = captured!.init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("test-key");

    const body = JSON.parse(captured!.init.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "system prompt" }] });
    expect(body.tools).toEqual([{ functionDeclarations: TOOLS }]);
    expect(body.toolConfig).toEqual({ functionCallingConfig: { mode: "ANY" } });
    expect(body.generationConfig).toEqual({ temperature: 0.2 });
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "hello" }] },
      { role: "model", parts: [{ text: "hi there" }] },
      {
        role: "model",
        parts: [{ functionCall: { name: "check_stay", args: { check_in: "2026-10-10", check_out: "2026-10-12" } } }],
      },
      { role: "user", parts: [{ functionResponse: { name: "check_stay", response: { result: { ok: true } } } }] },
    ]);
  });

  test("a functionCall response parses to a toolCall", async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ functionCall: { name: "respond", args: { reply: "hi", escalate: false } } }] } }],
      })) as typeof fetch;
    const model = new GeminiModel({ apiKey: "k", fetchImpl });
    const turn = await model.next("sys", [], TOOLS);
    expect(turn).toEqual({ toolCall: { name: "respond", args: { reply: "hi", escalate: false } } });
  });

  test("a non-200 response gives an error", async () => {
    const fetchImpl = (async () => jsonResponse({}, false, 500)) as typeof fetch;
    const model = new GeminiModel({ apiKey: "k", fetchImpl });
    const turn = await model.next("sys", [], TOOLS);
    expect(turn).toHaveProperty("error");
  });

  test("a text-only response gives an error", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: "just words" }] } }] })) as typeof fetch;
    const model = new GeminiModel({ apiKey: "k", fetchImpl });
    const turn = await model.next("sys", [], TOOLS);
    expect(turn).toHaveProperty("error");
  });

  test("no candidate at all gives an error", async () => {
    const fetchImpl = (async () => jsonResponse({ candidates: [] })) as typeof fetch;
    const model = new GeminiModel({ apiKey: "k", fetchImpl });
    const turn = await model.next("sys", [], TOOLS);
    expect(turn).toHaveProperty("error");
  });

  test("a fetch that never resolves times out", async () => {
    const fetchImpl = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const model = new GeminiModel({ apiKey: "k", fetchImpl, timeoutMs: 10 });
    const turn = await model.next("sys", [], TOOLS);
    expect(turn).toHaveProperty("error");
  });
});

describe("modelFromEnv", () => {
  test("is null without GEMINI_API_KEY", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(modelFromEnv()).toBeNull();
    if (original !== undefined) process.env.GEMINI_API_KEY = original;
  });
});

describe("ScriptedModel", () => {
  test("returns its turns in order, then an error", async () => {
    const scripted = new ScriptedModel([
      { toolCall: { name: "check_stay", args: {} } },
      { toolCall: { name: "respond", args: { reply: "hi", escalate: false } } },
    ]);
    const model: ChatModel = scripted;
    expect(await model.next("sys", [], TOOLS)).toEqual({ toolCall: { name: "check_stay", args: {} } });
    expect(await model.next("sys", [], TOOLS)).toEqual({ toolCall: { name: "respond", args: { reply: "hi", escalate: false } } });
    expect(await model.next("sys", [], TOOLS)).toEqual({ error: "script exhausted" });
    expect(scripted.calls).toHaveLength(3);
    expect(scripted.calls[0]).toEqual({ system: "sys", history: [] });
  });
});
