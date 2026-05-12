---
title: 'Code Style'
description: 'Coding conventions for Effect TypeScript and Elm in this repository'
section: contributing
order: 3
---

# Code Style

This repository uses two primary languages: Effect TypeScript for all runtime packages and Elm for the documentation site. Each has its own conventions.

## Effect TypeScript Conventions

### Prefer `Effect.fnUntraced` Over `Effect.gen` Wrappers

Instead of writing a function that returns `Effect.gen`:

```typescript
// Avoid
const fetchUser = (id: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient;
    return yield* client.get(`/users/${id}`);
  });
```

Use `Effect.fnUntraced`:

```typescript
// Preferred
const fetchUser = Effect.fnUntraced(function* (id: string) {
  const client = yield* HttpClient;
  return yield* client.get(`/users/${id}`);
});
```

### Use `Context.Service` Class Syntax

Define services using the class-based syntax:

```typescript
import { Context } from 'effect';

class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly findById: (id: string) => Effect.Effect<User, NotFoundError>;
    readonly save: (user: User) => Effect.Effect<void, DatabaseError>;
  }
>()('UserRepository') {}
```

### Never Use `async`/`await` or `try`/`catch`

All asynchronous and error-handling code must use Effect APIs:

```typescript
// Bad
const data = await fetch(url);

// Good
const data = yield * Effect.tryPromise(() => fetch(url));
```

### Never Use `Date.now()` or `new Date()`

Use the Effect `Clock` module for time operations. In tests, use `TestClock` to control time:

```typescript
import { Clock } from 'effect';

const now = yield * Clock.currentTimeMillis;
```

### Use `Schema.TaggedStruct` for Discriminated Unions

```typescript
const AuthEvent = Schema.TaggedStruct('AuthEvent', {
  type: Schema.String,
  timestamp: Schema.Number,
  data: Schema.Unknown,
});
```

## Testing Conventions

### Use `it.effect` for All Effect Tests

```typescript
import { assert, describe, it } from '@effect/vitest';

describe('UserRepository', () => {
  it.effect('finds a user by id', () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const user = yield* repo.findById('123');
      assert.strictEqual(user.name, 'Alice');
    }),
  );
});
```

### Use `assert` Instead of `expect`

The `@effect/vitest` package provides `assert` methods. Never import `expect` from vitest in Effect tests:

```typescript
// Bad
expect(result).toBe(42);

// Good
assert.strictEqual(result, 42);
```

### Test File Location

Test files live in `packages/<name>/test/` directories, mirroring the source structure.

## Elm Conventions

The docs site follows standard Elm conventions:

- **elm-format** — All Elm files must be formatted with `elm-format`. The pre-commit hook runs this automatically.
- **Module naming** — Modules use PascalCase and match their file path (e.g. `ApiDocs.TreeshakeCheck` lives at `src/ApiDocs/TreeshakeCheck.elm`).
- **Type annotations** — Every top-level function must have a type annotation.
- **No partial functions** — Never use `List.head`, `Maybe.withDefault` without documenting why, or any function that can crash. Use pattern matching instead.

## Changesets

Every pull request that changes a publishable package must include a changeset:

```bash
pnpm changeset
```

Follow the prompts to select the affected packages and the semver bump level. Write a concise description of what changed and why.

<callout type="info">Look at existing code in the repository before writing new code. The patterns directory (`.patterns/`) contains additional examples.</callout>
