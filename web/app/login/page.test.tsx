import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

// @req AUTH-02
test("the login page renders email and password fields", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
});
