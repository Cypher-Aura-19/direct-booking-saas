// @vitest-environment node
import { test, expect } from "vitest";
import { disabledCapabilityRequested, violatesDisabledCapability, languageViolation } from "./capabilities";
import { DEFAULT_AI_SETTINGS } from "../properties/ai-settings";

const allOn = DEFAULT_AI_SETTINGS.switches;

// @req AIC-11
test("a disabled topic is detected in the guest's message; an enabled one is not", () => {
  const off = { ...allOn, answer_house_rules: false };
  expect(disabledCapabilityRequested("What are the house rules about pets?", off)).toBe("answer_house_rules");
  expect(disabledCapabilityRequested("What are the house rules about pets?", allOn)).toBeNull();
});

// @req AIC-11
test("each of the four decline-topic switches has a matching phrase", () => {
  const off = {
    ...allOn,
    give_directions: false,
    recommend_nearby: false,
    take_booking_requests: false,
  };
  expect(disabledCapabilityRequested("How do I get there from the airport?", off)).toBe("give_directions");
  expect(disabledCapabilityRequested("Any good restaurants nearby?", off)).toBe("recommend_nearby");
  expect(disabledCapabilityRequested("I want to book this for next weekend", off)).toBe("take_booking_requests");
});

// @req AIC-11
test("an unrelated question matches no disabled topic", () => {
  const off = { ...allOn, answer_house_rules: false, give_directions: false, recommend_nearby: false, take_booking_requests: false };
  expect(disabledCapabilityRequested("Is there hot water in the mornings?", off)).toBeNull();
});

// @req AIC-12
test("violatesDisabledCapability scans a model reply the same way", () => {
  const off = { ...allOn, recommend_nearby: false };
  expect(violatesDisabledCapability("There's a great restaurant nearby called Cafe X.", off)).toBe(true);
  expect(violatesDisabledCapability("The geyser takes 15 minutes to heat up.", off)).toBe(false);
});

// @req AIC-09
test("languageViolation only fires when the switch is off and the reply isn't English", () => {
  const off = { ...allOn, answer_urdu: false };
  expect(languageViolation("Yahan par wifi ka password kya hai, kitna hai kiraya?", off)).toBe(true);
  expect(languageViolation("The wifi password is on the fridge.", off)).toBe(false);
  expect(languageViolation("Yahan par wifi ka password kya hai, kitna hai kiraya?", allOn)).toBe(false);
});
