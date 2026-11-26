import { expect, test } from "vitest";
import { filterItems, placePanel, stepIndex, typeAhead, type DdItem } from "./dropdown";

const teams: DdItem[] = [
  { value: "11115", label: "11115", sub: "Gluten Free" },
  { value: "12345", label: "12345", sub: "Bolt" },
  { value: "14469", label: "14469", sub: "Perth Modern Robotics Collective" },
  { value: "16021", label: "16021", sub: "Cogs and Sprockets" },
];

test("filterItems matches label or sub-text, ignoring case and outer spaces", () => {
  expect(filterItems(teams, "  bolt ").map((t) => t.value)).toEqual(["12345"]);
  expect(filterItems(teams, "1").length).toBe(4);
  expect(filterItems(teams, "144").map((t) => t.value)).toEqual(["14469"]);
  expect(filterItems(teams, "robotics c").map((t) => t.value)).toEqual(["14469"]);
  expect(filterItems(teams, "")).toBe(teams);
  expect(filterItems(teams, "zzz")).toEqual([]);
});

test("stepIndex moves with the arrows, Home and End, and stops at the ends", () => {
  expect(stepIndex(-1, "ArrowDown", 4)).toBe(0);
  expect(stepIndex(-1, "ArrowUp", 4)).toBe(3);
  expect(stepIndex(1, "ArrowDown", 4)).toBe(2);
  expect(stepIndex(3, "ArrowDown", 4)).toBe(3);
  expect(stepIndex(0, "ArrowUp", 4)).toBe(0);
  expect(stepIndex(2, "Home", 4)).toBe(0);
  expect(stepIndex(0, "End", 4)).toBe(3);
  expect(stepIndex(0, "Enter", 4)).toBeNull();
  expect(stepIndex(-1, "ArrowDown", 0)).toBeNull();
});

test("typeAhead steps through labels or names starting with a letter, and keeps a longer match", () => {
  const words: DdItem[] = ["Mecanum", "Tank", "Swerve", "Mecanum wide", "Other"].map((l) => ({ value: l, label: l }));
  expect(typeAhead(words, "m", -1)).toBe(0);
  expect(typeAhead(words, "m", 0)).toBe(3);
  expect(typeAhead(words, "m", 3)).toBe(0);
  expect(typeAhead(words, "mecanum w", 0)).toBe(3);
  expect(typeAhead(words, "sw", 2)).toBe(2);
  expect(typeAhead(words, "q", 0)).toBe(-1);
  expect(typeAhead(teams, "c", -1)).toBe(3);
  expect(typeAhead(words, "", 0)).toBe(-1);
});

test("placePanel sits under the button, or over it when below is short, kept inside the window", () => {
  expect(placePanel({ left: 20, top: 100, bottom: 148, width: 300 }, 1280, 800)).toEqual({ left: 20, width: 300, maxHeight: 380, top: 152, up: false });
  expect(placePanel({ left: 1200, top: 100, bottom: 148, width: 100 }, 1280, 800)).toMatchObject({ left: 1032, width: 240 });
  expect(placePanel({ left: 20, top: 700, bottom: 748, width: 300 }, 1280, 800)).toEqual({ left: 20, width: 300, maxHeight: 380, bottom: 104, up: true });
  expect(placePanel({ left: 20, top: 300, bottom: 348, width: 300 }, 1280, 500).maxHeight).toBe(288);
});
