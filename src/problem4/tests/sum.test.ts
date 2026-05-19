import { describe, it, expect } from "vitest";
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from "../index";

const implementations = [
  { name: "sum_to_n_a (formula)", fn: sum_to_n_a },
  { name: "sum_to_n_b (iterative)", fn: sum_to_n_b },
  { name: "sum_to_n_c (recursive)", fn: sum_to_n_c },
];

describe.each(implementations)("$name", ({ fn }) => {
  it("returns the example: sum_to_n(5) === 15", () => {
    expect(fn(5)).toBe(15);
  });

  it("returns 1 for n=1", () => {
    expect(fn(1)).toBe(1);
  });

  it("returns 0 for n=0", () => {
    expect(fn(0)).toBe(0);
  });

  it("returns 5050 for n=100", () => {
    expect(fn(100)).toBe(5050);
  });
});
