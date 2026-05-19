// O(1) time, O(1) space — Gauss closed-form formula
export function sum_to_n_a(n: number): number {
  return (n * (n + 1)) / 2;
}

// O(n) time, O(1) space — iterative accumulation
export function sum_to_n_b(n: number): number {
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += i;
  return sum;
}

// O(n) time, O(n) space — recursive (call stack depth = n)
export function sum_to_n_c(n: number): number {
  if (n <= 0) return 0;
  return n + sum_to_n_c(n - 1);
}
