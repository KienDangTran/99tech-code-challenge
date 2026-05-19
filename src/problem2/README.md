# Problem 2 — Fancy Form (Currency Swap)

## Approach

A currency swap form built with **React + TypeScript + Vite**. Prices are fetched from the Switcheo API and normalised (latest price per currency, zero-price entries dropped). Exchange rates are computed client-side as `amount × fromPrice / toPrice`. Submission is mocked with a configurable timeout to simulate a backend call.

Development followed a strict **TDD** workflow: unit tests for the pure logic (`normalizeTokens`, `computeReceive`, `validateAmount`) were written and made green first; component tests via Vitest + React Testing Library drove the UI behaviour.

## Code Structure

```
src/problem2/
├── app/
│   ├── components/
│   │   └── SwapForm.tsx      # main form component
│   ├── lib/
│   │   ├── prices.ts         # normalizeTokens + Token types
│   │   └── swap.ts           # computeReceive + validateAmount
│   ├── App.tsx               # root layout
│   ├── index.css             # Tailwind v4 import
│   └── main.tsx              # React entry point
├── tests/
│   ├── prices.test.ts        # normalizeTokens unit tests
│   ├── swap.test.ts          # computeReceive unit tests
│   ├── validate.test.ts      # validateAmount unit tests
│   └── SwapForm.test.tsx     # component integration tests
├── index.html
├── vite.config.ts            # Vite + Vitest + Tailwind config
└── tsconfig.json
```

## How to Run

```bash
# Development server
npm run problem2:dev

# Run tests
npm run problem2:test

# Production build
npm run problem2:build
```

Visit `http://localhost:5173` after starting the dev server.

## Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS v4
- Vitest + React Testing Library + jsdom
