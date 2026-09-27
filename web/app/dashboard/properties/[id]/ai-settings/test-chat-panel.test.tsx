import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TestChatPanel } from "./test-chat-panel";
import * as actions from "./actions";

vi.mock("./actions", () => ({ testAiReplyAction: vi.fn() }));

describe("TestChatPanel", () => {
  test("sends a message and shows the reply", async () => {
    vi.mocked(actions.testAiReplyAction).mockResolvedValue({ reply: "Yes, there is hot water.", escalated: false });
    render(<TestChatPanel propertyId="prop-1" />);

    fireEvent.change(screen.getByPlaceholderText(/wifi password/i), { target: { value: "Is there hot water?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Is there hot water?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Yes, there is hot water.")).toBeInTheDocument());
    expect(actions.testAiReplyAction).toHaveBeenCalledWith("prop-1", expect.any(FormData), [], "Is there hot water?");
  });

  test("shows a plain error notice when the action returns one", async () => {
    vi.mocked(actions.testAiReplyAction).mockResolvedValue({ error: "Something went wrong." });
    render(<TestChatPanel propertyId="prop-1" />);
    fireEvent.change(screen.getByPlaceholderText(/wifi password/i), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });
});
