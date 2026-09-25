import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  // @req FOUND-11
  it("renders its label", () => {
    render(<Button>Save changes</Button>);
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  // @req FOUND-11
  it("defaults to the primary variant", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-action");
  });

  // @req FOUND-11
  it("renders the secondary variant with a hairline border", () => {
    render(<Button variant="secondary">Cancel</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("border-hairline");
    expect(button).not.toHaveClass("bg-action");
  });

  // @req FOUND-11
  it("renders the ghost variant with no background", () => {
    render(<Button variant="ghost">Dismiss</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-transparent");
  });

  // @req A11Y-01
  it("meets the 44px minimum touch target", () => {
    render(<Button>Tap</Button>);
    expect(screen.getByRole("button")).toHaveClass("min-h-11");
  });

  // @req FOUND-11
  it("uses the pill radius", () => {
    render(<Button>Tap</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-pill");
  });

  // @req A11Y-02
  it("uses logical inline padding, not physical", () => {
    render(<Button>Tap</Button>);
    const className = screen.getByRole("button").className;
    expect(className).toContain("px-6");
    expect(className).not.toMatch(/\bpl-\d/);
    expect(className).not.toMatch(/\bpr-\d/);
  });

  // @req FOUND-11
  it("forwards native button attributes", () => {
    render(<Button type="submit" disabled />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
  });
});
