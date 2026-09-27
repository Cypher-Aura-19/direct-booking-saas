// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { TEST_CHAT_HISTORY_LIMIT } from "@/lib/chat/test-chat";

// dashboardContext() does real cookie-based auth (next/headers) and a
// redirect() on failure — neither of which this unit test wants to exercise.
// Mocking it lets us test testAiReplyAction's own input validation (added in
// this fix wave) in isolation, the same way test-chat-panel.test.tsx mocks
// this file's own exports one layer up.
const { dashboardContextMock, runTestTurnMock } = vi.hoisted(() => ({
  dashboardContextMock: vi.fn(),
  runTestTurnMock: vi.fn(),
}));
vi.mock("../../../_lib/context", () => ({ dashboardContext: dashboardContextMock }));

vi.mock("@/lib/chat/test-chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/test-chat")>("@/lib/chat/test-chat");
  return { ...actual, runTestTurn: runTestTurnMock };
});

// vi.mock calls above are hoisted above this import by Vitest, so
// testAiReplyAction (and its own import of test-chat) already see the mocks.
import { testAiReplyAction } from "./actions";

const GENERIC_ERROR = "Something went wrong. Please try again.";

beforeEach(() => {
  dashboardContextMock.mockReset();
  runTestTurnMock.mockReset();
  dashboardContextMock.mockResolvedValue({ supabase: {} });
});

test("dashboardContext runs before the arguments are ever touched", async () => {
  await testAiReplyAction("prop-1", new FormData(), [], "hi");
  expect(dashboardContextMock).toHaveBeenCalledTimes(1);
});

test("a non-array history is rejected without calling runTestTurn", async () => {
  const result = await testAiReplyAction("prop-1", new FormData(), { not: "an array" } as never, "hi");
  expect(result).toEqual({ error: GENERIC_ERROR });
  expect(runTestTurnMock).not.toHaveBeenCalled();
});

test("a history item missing text is rejected without calling runTestTurn", async () => {
  const history = [{ role: "guest" }] as never;
  const result = await testAiReplyAction("prop-1", new FormData(), history, "hi");
  expect(result).toEqual({ error: GENERIC_ERROR });
  expect(runTestTurnMock).not.toHaveBeenCalled();
});

test("a history item with an invalid role is rejected without calling runTestTurn", async () => {
  const history = [{ role: "host", text: "hi" }] as never;
  const result = await testAiReplyAction("prop-1", new FormData(), history, "hi");
  expect(result).toEqual({ error: GENERIC_ERROR });
  expect(runTestTurnMock).not.toHaveBeenCalled();
});

test("history longer than TEST_CHAT_HISTORY_LIMIT is rejected without calling runTestTurn", async () => {
  const history = Array.from({ length: TEST_CHAT_HISTORY_LIMIT + 1 }, () => ({ role: "guest", text: "hi" })) as never;
  const result = await testAiReplyAction("prop-1", new FormData(), history, "hi");
  expect(result).toEqual({ error: GENERIC_ERROR });
  expect(runTestTurnMock).not.toHaveBeenCalled();
});

test("a non-string message is rejected without calling runTestTurn", async () => {
  const result = await testAiReplyAction("prop-1", new FormData(), [], 12345 as never);
  expect(result).toEqual({ error: GENERIC_ERROR });
  expect(runTestTurnMock).not.toHaveBeenCalled();
});

test("well-shaped arguments reach runTestTurn", async () => {
  runTestTurnMock.mockResolvedValue({ reply: "hi there", escalated: false });
  const history = [{ role: "guest", text: "hi" }] as never;
  const result = await testAiReplyAction("prop-1", new FormData(), history, "hi");
  expect(result).toEqual({ reply: "hi there", escalated: false });
  expect(runTestTurnMock).toHaveBeenCalledTimes(1);
});
