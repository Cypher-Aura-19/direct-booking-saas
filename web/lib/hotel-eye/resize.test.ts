// @vitest-environment node
import { test, expect } from "vitest";
import { scaleToFit } from "./resize";

test("scaleToFit shrinks the longer side to the limit and never enlarges", () => {
  expect(scaleToFit(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  expect(scaleToFit(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  expect(scaleToFit(800, 600, 1600)).toEqual({ width: 800, height: 600 });
});
