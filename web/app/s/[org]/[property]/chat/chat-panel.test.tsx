import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatPanel } from "./chat-panel";
import { loadChatAction, sendMessageAction, startChatAction } from "./actions";

// The network boundary of a client component: the Server Actions are mocked
// with canned data (the only mocks in M7). Everything behind them is covered
// by the lib tests against the real database.
vi.mock("./actions", () => ({
  startChatAction: vi.fn(),
  sendMessageAction: vi.fn(),
  loadChatAction: vi.fn(),
}));

const TOKEN = "a".repeat(64);
const KEY = "qayam-chat:p1";
const start = vi.mocked(startChatAction);
const send = vi.mocked(sendMessageAction);
const load = vi.mocked(loadChatAction);

const reply = (question: string) => ({
  escalated: false,
  messages: [
    { id: "m1", sender: "guest" as const, body: question, lang: "en" as const },
    { id: "m2", sender: "ai" as const, body: "Yes, the weekend of 10 October is open.", lang: "en" as const },
  ],
});

const panel = (props: Partial<Parameters<typeof ChatPanel>[0]> = {}) => (
  <ChatPanel propertyId="p1" propertyName="River Hut" hostName="Altit Heights" {...props} />
);

beforeEach(() => {
  localStorage.clear();
  start.mockReset().mockResolvedValue({ token: TOKEN });
  send.mockReset().mockImplementation(async (_token, text) => reply(text));
  load.mockReset().mockResolvedValue(reply("Is it available next weekend?"));
});

afterEach(() => {
  vi.useRealTimers();
});

// @req AI-04
it("renders inline as a page section, not a fixed or floating widget", () => {
  render(panel());
  const region = screen.getByRole("region", { name: "Ask a question" });
  expect(region.className).not.toMatch(/fixed|floating/);
  for (const el of region.querySelectorAll("*")) expect(el.className.toString()).not.toMatch(/\bfixed\b/);
  expect(within(region).getByText("Ask Altit Heights's assistant anything about River Hut")).toBeInTheDocument();
});

// @req AI-05
it("offers four starter questions; tapping one starts the chat and sends it", async () => {
  render(panel());
  const starters = within(screen.getByRole("group", { name: /suggested questions/i })).getAllByRole("button");
  expect(starters.map((b) => b.textContent)).toEqual([
    "Is it available next weekend?",
    "What's the price per night?",
    "Is there parking and hot water?",
    "How do I get there?",
  ]);
  for (const b of starters) expect(b).toHaveClass("chat-starter");

  fireEvent.click(starters[0]);
  await screen.findByText("Yes, the weekend of 10 October is open.");
  expect(start).toHaveBeenCalledWith("p1");
  expect(send).toHaveBeenCalledWith(TOKEN, "Is it available next weekend?");
  expect(start.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  expect(screen.queryByRole("group", { name: /suggested questions/i })).not.toBeInTheDocument();
});

// @req AI-03
it("keeps the token so a returning guest sees their history, and offers a saved link", async () => {
  const { unmount } = render(panel());
  fireEvent.click(screen.getByRole("button", { name: "What's the price per night?" }));
  await screen.findByText("Yes, the weekend of 10 October is open.");
  expect(localStorage.getItem(KEY)).toBe(TOKEN);
  expect(screen.getByRole("link", { name: /save this chat/i })).toHaveAttribute("href", `/c/${TOKEN}`);
  expect(screen.getByText("Bookmark this link to come back to your chat.")).toBeInTheDocument();
  unmount();

  render(panel());
  await screen.findByText("Yes, the weekend of 10 October is open.");
  expect(load).toHaveBeenCalledWith(TOKEN);
  expect(start).toHaveBeenCalledTimes(1);
});

// @req SEC-06
it("forgets a stored token the server marks invalid", async () => {
  localStorage.setItem(KEY, TOKEN);
  load.mockResolvedValue({ error: "This chat link isn't valid.", invalidToken: true });
  render(panel());
  await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
  expect(screen.getByRole("group", { name: /suggested questions/i })).toBeInTheDocument();
});

// @req AI-03
it("keeps a stored token on a transient load failure and shows a retry-able error, instead of forgetting it", async () => {
  localStorage.setItem(KEY, TOKEN);
  load.mockResolvedValue({ error: "Something went wrong. Please try again in a moment." });
  render(panel());
  expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
  // Not forgotten: the token survives in storage...
  expect(localStorage.getItem(KEY)).toBe(TOKEN);
  // ...and in the component's own state, so the guest's next message still
  // reaches this same conversation rather than silently starting a new one.
  fireEvent.change(screen.getByRole("textbox", { name: /your message/i }), { target: { value: "Still there?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Yes, the weekend of 10 October is open.");
  expect(send).toHaveBeenCalledWith(TOKEN, "Still there?");
  expect(start).not.toHaveBeenCalled();
});

// @req AI-03
it("a transient load failure on the same rejected token still keeps it if the token is not marked invalid", async () => {
  // Guards against distinguishing invalid-vs-transient by string content
  // rather than by the discriminated field: same generic wording, but no
  // `invalidToken` flag, must not clear storage.
  localStorage.setItem(KEY, TOKEN);
  load.mockResolvedValue({ error: "This chat link isn't valid." });
  render(panel());
  await screen.findByRole("alert");
  expect(localStorage.getItem(KEY)).toBe(TOKEN);
});

it("ignores a malformed stored token without calling the server", () => {
  localStorage.setItem(KEY, "not-a-token");
  render(panel());
  expect(load).not.toHaveBeenCalled();
});

it("an initial token from a saved link wins and is stored", async () => {
  const saved = "b".repeat(64);
  localStorage.setItem(KEY, TOKEN);
  render(panel({ initialToken: saved }));
  await screen.findByText("Yes, the weekend of 10 October is open.");
  expect(load).toHaveBeenCalledWith(saved);
  expect(localStorage.getItem(KEY)).toBe(saved);
});

// @req AI-18
it("the composer has 44px targets, sends on Enter, and disables Send while waiting", async () => {
  let resolve!: (v: Awaited<ReturnType<typeof sendMessageAction>>) => void;
  send.mockImplementation(() => new Promise((r) => { resolve = r; }));
  render(panel());
  const input = screen.getByRole("textbox", { name: /your message/i });
  const button = screen.getByRole("button", { name: "Send" });
  expect(input).toHaveClass("min-h-11");
  expect(input).toHaveAttribute("maxLength", "1000");
  expect(button).toHaveClass("min-h-11");

  fireEvent.change(input, { target: { value: "Is breakfast included?" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  expect(start).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });

  await waitFor(() => expect(send).toHaveBeenCalledWith(TOKEN, "Is breakfast included?"));
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(screen.getByText(/assistant is typing/i)).toBeInTheDocument();
  expect(screen.getByText("Is breakfast included?")).toBeInTheDocument();

  await act(async () => resolve(reply("Is breakfast included?")));
  expect(screen.queryByText(/assistant is typing/i)).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /your message/i })).toHaveValue("");
});

it("shows an error in a notice and keeps the guest's words to retry", async () => {
  send.mockResolvedValue({ error: "You've sent a lot of messages. The host will reply here soon." });
  render(panel());
  const input = screen.getByRole("textbox", { name: /your message/i });
  fireEvent.change(input, { target: { value: "Hello?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You've sent a lot of messages.");
  expect(input).toHaveValue("Hello?");
});

it("labels host and assistant messages, and renders Urdu right-to-left", async () => {
  localStorage.setItem(KEY, TOKEN);
  load.mockResolvedValue({
    escalated: true,
    messages: [
      { id: "m1", sender: "guest", body: "کیا پارکنگ ہے؟", lang: "ur" },
      { id: "m2", sender: "ai", body: "جی ہاں، پارکنگ موجود ہے۔", lang: "ur" },
      { id: "m3", sender: "host", body: "Parking is free.", lang: "en" },
    ],
  });
  render(panel());
  const urdu = await screen.findByText("کیا پارکنگ ہے؟");
  expect(urdu).toHaveAttribute("lang", "ur");
  expect(urdu).toHaveAttribute("dir", "rtl");
  const host = screen.getByText("Parking is free.");
  expect(host).toHaveAttribute("lang", "en");
  expect(host).not.toHaveAttribute("dir");
  expect(host.closest(".chat-message")).toHaveAttribute("data-sender", "host");
  expect(within(host.closest(".chat-message") as HTMLElement).getByText("Host")).toBeInTheDocument();
  expect(within(screen.getByText("جی ہاں، پارکنگ موجود ہے۔").closest(".chat-message") as HTMLElement).getByText("Assistant")).toBeInTheDocument();
});

it("polls for host replies every 20 seconds while the page is visible", async () => {
  vi.useFakeTimers();
  localStorage.setItem(KEY, TOKEN);
  render(panel());
  await act(async () => { await Promise.resolve(); });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { vi.advanceTimersByTime(20_000); });
  expect(load).toHaveBeenCalledTimes(2);
});
