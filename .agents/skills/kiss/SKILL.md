---
name: kiss
description: Apply the user's KISS preference during this project's implementation and review, including reusing existing functions and avoiding both complicated logic and oversimplified code.
---

# KISS

Use existing functions and standard library capabilities when they fit the requirement.
Choose straightforward, readable code with enough structure to enforce the specified behaviour.

- Prefer a clear conditional, lookup table or focused function over custom frameworks and deeply nested logic.
- Avoid clever one-liners, unnecessary wrappers, speculative extensibility and redundant dependencies.
- Do not simplify away lifecycle checks, error handling, independent scan/report states or stale-estimate protection.
- Keep functions focused, use explicit names and shared types, and explain non-obvious decisions briefly.
- Before finishing a change, look for an existing function that can replace duplicated or complicated code.

