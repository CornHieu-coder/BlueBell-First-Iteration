---
name: dry
description: Apply DRY while implementing or reviewing this project's code, especially shared scheduling rules, contracts and escalation behaviour.
---

# DRY

- Search for an existing function, type or constant before adding a similar one.
- Keep each business rule in one authoritative place. Reuse shared contracts across client and server.
- Extract genuinely repeated behaviour into a focused helper; keep callers clear.
- Do not merge unrelated logic just because it looks similar, or build generic abstractions for imagined reuse.
- During review, check that changing a scheduling or escalation rule requires editing one implementation.

