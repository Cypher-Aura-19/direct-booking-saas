import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiSettingsForm } from "./ai-settings-form";
import { DEFAULT_AI_SETTINGS } from "@/lib/properties/ai-settings";

describe("AiSettingsForm", () => {
  test("renders one checkbox per switch, checked to match the saved settings", () => {
    const settings = { ...DEFAULT_AI_SETTINGS, switches: { ...DEFAULT_AI_SETTINGS.switches, give_directions: false } };
    render(<AiSettingsForm action={vi.fn().mockResolvedValue({ error: null, success: true })} settings={settings} />);
    expect(screen.getByLabelText(/give directions/i)).not.toBeChecked();
    expect(screen.getByLabelText(/answer house rules/i)).toBeChecked();
  });

  test("renders the id ai-settings-form so the test panel can read it", () => {
    const { container } = render(<AiSettingsForm action={vi.fn()} settings={DEFAULT_AI_SETTINGS} />);
    expect(container.querySelector("form#ai-settings-form")).not.toBeNull();
  });

  test("submitting shows the saved notice", async () => {
    const action = vi.fn().mockResolvedValue({ error: null, success: true });
    render(<AiSettingsForm action={action} settings={DEFAULT_AI_SETTINGS} />);
    fireEvent.click(screen.getByRole("button", { name: /save ai settings/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
  });
});
