import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/brand";
import Page from "./page";

describe("home page", () => {
  // @req FOUND-02
  it("renders the product name", () => {
    render(<Page />);
    expect(screen.getByRole("banner")).toHaveTextContent(PRODUCT_NAME);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  // @req FOUND-03
  it("renders a main landmark", () => {
    render(<Page />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
