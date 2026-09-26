import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import PublicNotFound from "./not-found";
import PublicPropertyNotFound from "./[property]/not-found";

// @req PUB-06
it("shows a written not-found page for an unknown host", () => {
  render(<PublicNotFound />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("We couldn't find that host.");
});

// @req PUB-06
it("shows place-appropriate copy for an unknown property under a known host, not the host wording", () => {
  render(<PublicPropertyNotFound />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("We couldn't find that place.");
});
