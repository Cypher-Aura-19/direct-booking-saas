import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkifiedBody } from "./linkify";

const TOKEN = "a".repeat(64);

// @req CNIC-01
test("an /id/<token> path in a chat message becomes a same-origin link; other text is untouched", () => {
  render(<p><LinkifiedBody body={`Payment received. Please upload your ID: /id/${TOKEN} - thanks`} /></p>);
  const link = screen.getByRole("link", { name: /upload your id/i });
  expect(link).toHaveAttribute("href", `/id/${TOKEN}`);
  expect(screen.getByText(/Payment received/)).toBeInTheDocument();
});

test("anything that is not exactly /id/<64 hex> stays plain text", () => {
  render(<p><LinkifiedBody body="see /id/short and https://evil.example/id/zzz" /></p>);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
