// @vitest-environment node
import { test, expect } from "vitest";
import { detectLanguage, langAttribute, holdingMessage, isHumanRequest } from "./language";

// @req AI-08
test("detectLanguage: plain English, a greeting and a lone Urdu word stay English", () => {
  expect(detectLanguage("Is there parking?")).toBe("en");
  expect(detectLanguage("Hi")).toBe("en");
  expect(detectLanguage("haan")).toBe("en");
});

// @req AI-09
test("detectLanguage: any Arabic-script letter is Urdu", () => {
  expect(detectLanguage("کیا پارکنگ ہے؟")).toBe("ur");
});

// @req AI-10
test("detectLanguage: two or more distinct Roman Urdu tokens is Roman Urdu", () => {
  expect(detectLanguage("kya yahan parking hai?")).toBe("roman-ur");
  expect(detectLanguage("KYA parking HAI")).toBe("roman-ur");
  // The same token twice counts once.
  expect(detectLanguage("hai hai parking")).toBe("en");
});

test("langAttribute maps each language to its HTML lang value", () => {
  expect(langAttribute("en")).toBe("en");
  expect(langAttribute("ur")).toBe("ur");
  expect(langAttribute("roman-ur")).toBe("ur-Latn");
});

// @req AI-16
test("holdingMessage in each language", () => {
  expect(holdingMessage("en")).toBe("Good question — I'm checking with the host, and they'll reply here soon.");
  expect(holdingMessage("ur")).toBe("اچھا سوال ہے — میں میزبان سے پوچھ رہا ہوں، وہ جلد یہیں جواب دیں گے۔");
  expect(holdingMessage("roman-ur")).toBe(
    "Acha sawal hai — main host se pooch raha hoon, woh jald yahin jawab denge.",
  );
});

// @req AI-14
test("isHumanRequest recognises asks for a person in English, Roman Urdu and Urdu", () => {
  expect(isHumanRequest("Can I talk to a human?")).toBe(true);
  expect(isHumanRequest("host se baat karni hai")).toBe(true);
  expect(isHumanRequest("میزبان سے بات کرنی ہے")).toBe(true);
  expect(isHumanRequest("I want to SPEAK WITH someone")).toBe(true);
  expect(isHumanRequest("Can I speak with the owner?")).toBe(true);
  expect(isHumanRequest("talk to the host")).toBe(true);
  expect(isHumanRequest("Could I chat with your host please")).toBe(true);
  expect(isHumanRequest("I need to talk to an agent")).toBe(true);
  expect(isHumanRequest("let me speak to my host")).toBe(true);
  expect(isHumanRequest("please call me")).toBe(true);
  expect(isHumanRequest("malik se rabta karwa dein")).toBe(true);
  expect(isHumanRequest("مالک سے بات")).toBe(true);
  expect(isHumanRequest("انسان سے بات کروائیں")).toBe(true);
});

// @req AI-14
test("isHumanRequest does not fire on ordinary questions", () => {
  expect(isHumanRequest("Is the host nice?")).toBe(false);
  expect(isHumanRequest("What time is check-in?")).toBe(false);
});
