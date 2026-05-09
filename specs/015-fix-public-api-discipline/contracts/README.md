# Contracts

This directory is intentionally empty.

This feature is a **structural refactor** of internal source-tree organization (Principle IX).
It introduces no new external interfaces and modifies no existing ones:

- No new HTTP endpoints.
- No changes to existing endpoint shapes (request bodies, response bodies, status codes).
- No new public library APIs published from `@my-binder/core`.
- No CLI surface.

Per the plan-template guidance ("Skip if project is purely internal"), no contract files
are required.

If, during implementation, an unexpected external surface change emerges (e.g., a moved
type proves to be part of an inadvertently-public API), document it here as a contract
addendum and re-run the Constitution Check before proceeding.
