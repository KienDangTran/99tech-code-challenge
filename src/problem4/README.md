# Problem 4 — Three Ways to Sum to N

## Approach

Three implementations of `sum_to_n(n)` — computes `1 + 2 + ... + n`.

| Function | Strategy | Time | Space |
|---|---|---|---|
| `sum_to_n_a` | Gauss closed-form: `n*(n+1)/2` | O(1) | O(1) |
| `sum_to_n_b` | Iterative loop | O(n) | O(1) |
| `sum_to_n_c` | Recursion | O(n) | O(n) call stack |

`sum_to_n_a` is the most efficient — a single arithmetic expression. `sum_to_n_b` trades constant time for a linear scan but uses no extra memory. `sum_to_n_c` is the most readable recursive formulation but risks stack overflow for very large `n`.

## Code Structure

```
src/problem4/
├── index.ts              # three sum_to_n implementations
├── vitest.config.ts      # test runner config
└── tests/
    └── sum.test.ts       # parameterised tests for all three functions
```

## How to Run

```bash
# Run the solution
npm run problem4

# Run tests
npm run problem4:test
```
