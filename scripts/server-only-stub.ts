/**
 * No-op stand-in for the `server-only` marker module.
 *
 * Next.js resolves `server-only` itself; plain `tsx` cannot. Rather than copy
 * the SMS bodies into the checker — which would let the real ones drift away
 * from the copy being checked, the exact failure the checker exists to catch —
 * `scripts/tsconfig.json` maps the specifier here. The mapping is scoped to
 * this directory, so the app build keeps its genuine server-only enforcement.
 */
export {};
