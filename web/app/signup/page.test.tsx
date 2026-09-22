import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SignupPage from "./page";

// @req AUTH-01
test("the signup page renders name, email and password fields", () => {
  render(<SignupPage />);
  expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
});
