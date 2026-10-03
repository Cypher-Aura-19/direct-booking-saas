// @vitest-environment node
import { test, expect } from "vitest";
import { isMoneyRequest } from "./money";

test("refund, charge, deposit and cancellation wording is a money request", () => {
  for (const text of [
    "I want a refund for last night",
    "Can I get my money back?",
    "Please reimburse me for the broken heater",
    "Why was I charged extra?",
    "I was charged twice",
    "Is there an additional charge for the bonfire?",
    "Do I get my security deposit back",
    "I'd like to cancel my booking",
    "Can you give me a discount for the inconvenience",
    "Paise wapas chahiye",
    "مجھے ریفنڈ چاہیے",
  ]) {
    expect(isMoneyRequest(text), text).toBe(true);
  }
});

test("ordinary stay questions are not money requests", () => {
  for (const text of [
    "What is the wifi password?",
    "What time is checkout?",
    "Is there a phone charging point in the room?",
    "Can I get extra towels?",
    "Where can I park the car?",
    "How do I use the geyser?",
    "The heater is not working",
  ]) {
    expect(isMoneyRequest(text), text).toBe(false);
  }
});
