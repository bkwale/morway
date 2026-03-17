# Engineering Doctrine — Morway

Author: Wale Koleosho
Purpose: The single source of truth for how code is written in this project. Claude reads this at session start. Every principle here is a directive, not a suggestion.

---

## 0. The Prime Directive

I write software for the next engineer who must understand it under pressure — a teammate, my future self, or an on-call engineer during an incident. If they can't understand the system quickly, the system is fragile.

When principles below conflict, I resolve in this order:
1. **Correctness** — wrong output is worse than slow output
2. **Clarity** — if I can't read it, I can't fix it
3. **Observability** — if I can't see it, I can't debug it
4. **Simplicity** — fewer moving parts, fewer failure modes

---

## 1. Clarity Before Cleverness

If code is hard to read, it is hard to verify, review, and debug.

- Prefer explicit code over "smart" code.
- No compressed one-liners for non-trivial logic.
- Names explain intent, not just implementation.
- A tired engineer must understand it at 2am.

---

## 2. Make Illegal States Impossible

Many bugs exist because invalid data is allowed to exist.

- Validate inputs at system boundaries.
- Prefer strong types, enums, schemas, and constrained models.
- No vague data structures when a defined model is possible.
- Fail early when required data is missing or malformed.

---

## 3. Architecture Layers

Every system follows clear layers. Do not mix them.

1. **Interface Layer** — API routes, CLI commands, UI events
2. **Validation Layer** — all input verified before entering the system
3. **Domain Logic Layer** — core business rules, pure and deterministic
4. **Persistence Layer** — database reads and writes
5. **Integration Layer** — external services and APIs

Core business logic never imports database clients or HTTP libraries directly. I/O belongs at the edges.

---

## 4. Single Responsibility

If a function does two things, it is two functions.

- Each function has one clear purpose.
- If the name requires "and", split it.
- Parsing, validation, transformation, persistence, and notification are separate concerns.

---

## 5. Naming Is a Correctness Tool

Poor naming leads to misuse.

- Names reflect domain meaning.
- Avoid vague names: `data`, `handler`, `process`, `object`, `result`, `info`.
- Explicit verbs for actions, nouns for entities.
- Distinguish internal IDs from external references.

---

## 6. Strict at System Boundaries

External input is messy. Internal systems must not be.

- API payloads, user input, environment variables, and third-party responses are untrusted.
- Normalise data immediately after it enters the system.
- Convert external formats into internal models before using them.
- Never pass raw external data deeper than one function call.

---

## 7. Fail Loudly, Never Silently

Silent failure hides problems until they compound.

- Never swallow exceptions without logging or rethrowing.
- Provide actionable error messages.
- Distinguish user-facing errors from system errors.
- If a catch block is empty, it is a bug.

---

## 8. Errors Carry Context

An error message without context is useless at 3am.

- Log identifiers: user IDs, transaction IDs, invoice IDs, operation names.
- Log enough to reconstruct what happened.
- Never log secrets: passwords, tokens, API keys, PII.

---

## 9. Deterministic Behaviour

Unpredictable code leads to intermittent bugs — the hardest kind.

- No hidden side effects.
- No shared mutable state where avoidable.
- Inputs and outputs are explicit.
- Same input always produces same output in domain logic.

---

## 10. Defensive but Practical

Assume mistakes will happen. Don't be paranoid, be prepared.

- Validate external input.
- Use assertions for developer assumptions.
- Protect critical invariants without cluttering code.

---

## 11. Explicit Contracts

Ambiguity causes misuse.

- Each function clearly defines inputs and outputs.
- APIs define required fields, optional fields, and possible responses.
- Error behaviour and edge cases are documented, not discovered.

---

## 12. Idempotency by Default

In distributed systems, retries and duplicates are inevitable.

- Critical operations are safe to retry.
- Detect and handle duplicate processing.
- Use idempotency keys where appropriate.
- Long workflows can safely resume after failure.

---

## 13. Immutable Data Flows

Mutable shared state causes confusion and hidden bugs.

- Do not modify shared objects in place.
- Return new values instead of mutating inputs.
- State transitions are explicit and logged.

---

## 14. Reduce Branching Complexity

Nested conditional logic multiplies the paths bugs can hide in.

- Use guard clauses for early exits.
- Flatten nested conditions.
- Extract complex decisions into named functions.

---

## 15. State Changes Are Observable

Important state transitions must be traceable.

- Log major business events with structured data.
- Maintain audit trails for important operations.
- Always answer: who changed something, when, and why.

---

## 16. Test Behaviour, Not Implementation

Tests verify outcomes, not internal mechanics.

- Unit tests for business logic.
- Integration tests for system boundaries.
- End-to-end tests sparingly but strategically.
- Every test covers: success path, edge cases, failure scenarios.

---

## 17. Every Bug Is Feedback

A bug is not just a fix. It is a signal about system weakness.

When a bug occurs:
1. Fix the issue.
2. Add or improve a test.
3. Strengthen validation.
4. Improve logging if diagnosis was difficult.
5. Document the lesson.

---

## 18. Tooling Reduces Human Error

Humans forget. Tooling does not.

- Use linters and formatters.
- Use static typing everywhere.
- Enforce automated checks in CI.

---

## 19. Code Review Checklist

Before approving code:
- Is the intent clear?
- Are edge cases handled?
- Are failures observable?
- Is the code testable?
- Are side effects controlled?
- Does naming reflect intent?

If the reviewer can't explain the code quickly, the code must change.

---

## 20. Logging as a Product

Logs are for engineers diagnosing issues at speed, not for decorating console output.

- Use structured logs (JSON or key-value).
- Include correlation or request IDs.
- Avoid noisy logs that hide important signals.
- Log: request start, key decisions, external calls, failures, completion.

---

## 21. Observability

A production system must expose operational signals.

Required: error rates, request latency, system throughput, retry counts, queue depth.

Without observability, debugging is archaeology.

---

## 22. Design for Partial Failure

External systems fail unpredictably.

- Use timeouts on every external call.
- Design safe retry strategies with backoff.
- Plan compensation logic when atomic transactions are impossible.

---

## 23. Centralise Business Rules

Business logic scattered across components leads to inconsistent behaviour.

- Keep business rules discoverable and centralised.
- Never duplicate validation logic.
- One source of truth per rule.

---

## 24. Version Contracts Carefully

APIs are long-lived contracts.

- No breaking changes without versioning.
- Document deprecations clearly.
- Maintain backward compatibility.

---

## 25. Data Models Stay Simple

Complex schemas cause long-term maintenance pain.

- Model only what the business truly needs.
- No overly generic or overloaded structures.
- Prefer explicit types over dynamic structures.

---

## 26. Proven Patterns Over Custom Magic

Custom abstractions feel elegant at first. They become debt later.

- Use established frameworks and patterns.
- No unnecessary internal frameworks.
- Reach for reliable libraries instead of reinventing utilities.

---

## 27. Dev/Prod Parity

Bugs love the gap between development and production.

- Keep configurations aligned.
- Test against realistic datasets.
- If it works differently in dev, it will break differently in prod.

---

## 28. One Clear Path

Consistency speeds up debugging.

- Use standard patterns across the codebase.
- Avoid unnecessary variation in how similar problems are solved.
- New code follows existing conventions unless those conventions are wrong.

---

## 29. Document Decisions, Not Syntax

Comments explain why, not what.

- Document trade-offs, constraints, and reasoning.
- No comments that restate obvious code.
- If a decision was hard, write down why you made it.

---

## 30. Leave It Better

Every change should improve maintainability.

- Remove dead code.
- Reduce duplication.
- Strengthen tests and observability.

---

## 31. Race Conditions and Concurrent Writes

**Added because: Morway's email ingest can receive duplicate invoices simultaneously. Silent data corruption is the worst category of bug.**

- Use database-level unique constraints for natural keys (invoiceNumber + clientId + currency + grossAmount).
- Use SELECT FOR UPDATE or advisory locks when read-then-write patterns exist.
- Never rely solely on application-level dedup checks — two requests can pass the check before either writes.
- Test concurrent scenarios explicitly, not just sequential ones.
- If two processes can touch the same row, one of them must lose gracefully.

---

## 32. Schema Migration Safety

**Added because: we've added fields without migration guards. This breaks on deploy.**

- Every schema change must be backward-compatible or deployed in two phases:
  1. Add new column (nullable or with default).
  2. Deploy code that writes to it.
  3. Backfill existing data.
  4. Only then make it required.
- Never rename or drop a column in the same deploy that stops using it.
- Run `prisma db push` or migrations in CI, not manually.
- Test the migration against a copy of production data, not an empty database.

---

## 33. Null Propagation Discipline

**Added because: TypeScript's optional chaining (`?.`) hides bugs by silently converting missing data to `undefined` five functions deep.**

- At system boundaries, decide: is this field required or optional? Enforce it.
- Never use `?? 'default'` to paper over data that should exist. If it should exist and doesn't, throw.
- Avoid deep `?.` chains. If you're chaining more than two levels, the data model is wrong or the validation layer missed something.
- Distinguish between "absent" (field not provided) and "empty" (field provided but blank). They mean different things.
- Functions that accept nullable params must handle null at the top, not buried in logic.

---

## 34. AI Output Validation

**Added because: Claude's responses are non-deterministic. We feed them directly into the data pipeline. Garbage in, garbage out.**

- Always validate AI-extracted JSON against a schema before using it. Check required fields, types, and value ranges.
- Treat AI output like untrusted external input (see Principle 6).
- Bound confidence scores: if `accountCodeConfidence` is outside 0.0-1.0, clamp or reject.
- Set a minimum quality threshold: if Claude returns an invoice with no number, no supplier, and no line items, reject it — don't create a garbage record.
- Log the raw AI response before parsing so failures can be diagnosed.
- Handle Claude API failures (rate limits, timeouts, malformed responses) with explicit fallback paths, not silent swallowing.

---

## 35. Dependency Failure Isolation

**Added because: Morway depends on Resend (email), Claude API (parsing), and Turso (database). If any one fails, the others should not cascade.**

- Every external call has a timeout. No exceptions.
- Distinguish transient failures (retry) from permanent failures (alert and stop).
- Queue work when possible — accept the email, persist it, process later. Don't hold the webhook open while calling Claude.
- If a third-party is down, the user should see a clear status, not a blank screen or a cryptic 500.
- Track external dependency health: response times, error rates, retry counts.
- Never let a slow upstream call block the entire request pipeline.

---

## 36. Security Baselines

Security is part of system design, not a separate checklist.

- Validate all inputs.
- Never log secrets.
- Apply least-privilege access.
- Protect authentication flows.
- Treat external integrations as untrusted.
- Webhook endpoints verify signatures before processing.

---

## 37. Incident Readiness

Production failures must be diagnosable within minutes, not hours.

Systems must provide: structured logs, correlation IDs, request tracing, clear error messages.

Debugging must never rely on guesswork.

---

## 38. Ship Incrementally

**Added because: the last 20% is where things stall. Small, working increments beat large, perfect releases.**

- Prefer working software over perfect software.
- Ship behind feature flags when the feature isn't ready for all users.
- Every merge to main should be deployable.
- If a task has been "almost done" for more than a day, break it into smaller pieces.
