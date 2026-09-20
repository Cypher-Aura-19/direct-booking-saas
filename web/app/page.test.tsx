import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("home page", () => {
  // @req FOUND-02
  it("renders the product name", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Direct Booking Platform",
    );
  });

  // @req FOUND-03
  it("renders a main landmark", () => {
    render(<Page />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
