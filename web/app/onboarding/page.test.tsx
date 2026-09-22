import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OnboardingPage from "./page";

// @req AUTH-09
test("the onboarding page renders name, slug, city and phone fields", () => {
  render(<OnboardingPage />);
  expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/public slug/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
});
