# Sign-Up Account-Enumeration Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the sign-up flow from disclosing whether an email address already has an account — remove the verbatim better-auth "User already exists. Use another email." string from both the rendered page and the API response.

**Architecture:** Two layers. (1) A shared client helper maps better-auth error objects to a fixed set of localized message keys and never reads `error.message`, so upstream copy can never reach the screen again. (2) A better-auth `hooks.before` guard on `/sign-up/email` replaces the duplicate-email error with a neutral code before it leaves the server, so the disclosing string is not in the HTTP response either.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, better-auth 1.6.9, next-intl, Vitest + Testing Library, Playwright.

**Spec:** this document, § Spec below.

---

## Spec

### The bug

`app/[locale]/(auth)/sign-up/page.tsx` does:

```tsx
if (result.error) {
  setError(result.error.message || 'Failed to create account');
}
```

better-auth 1.6.9 (`node_modules/better-auth/dist/api/routes/sign-up.mjs:205`) answers a
sign-up for an existing email with:

```
HTTP 422  { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
            message: "User already exists. Use another email." }
```

The page prints that message verbatim. Anyone can type an address into the public
sign-up form and learn whether it has an account. Same pattern, same file family:
`app/[locale]/(auth)/sign-in/page.tsx:56` renders `result.error.message` too.

Secondary defect from the same line: the message is upstream English, so Spanish
users get an untranslated string on a fully localized page.

### Why better-auth's own mitigation is not available

better-auth has a built-in generic duplicate response (returns a synthetic user with
`token: null` and HTTP 200, plus a decoy password hash for timing parity). It is gated
on `emailAndPassword.requireEmailVerification`
(`sign-up.mjs:160`: `const shouldReturnGenericDuplicateResponse = ctx.context.options.emailAndPassword.requireEmailVerification`).
This app sets `requireEmailVerification: false` (`lib/auth.ts`, "Simplified for MVP"),
and enabling it also disables auto-sign-in — which would break the
signup → `/start` → first-board flow. That is a product change, out of scope here.

### Scope and the residual risk (state this in the PR)

In scope:

- The page must never render an upstream error string. All server-side sign-up
  failures collapse to one localized, non-committal message.
- The API must not emit the phrase "User already exists" for a duplicate sign-up.
- Same treatment for sign-in, because it shares the identical `error.message`
  rendering and the same shared helper fixes it.

**Not** in scope, and must be disclosed as a known residual: a duplicate sign-up still
returns HTTP 422 while a fresh one returns 200 + a session cookie. Sign-up is
inherently enumerable at the status-code level until it is gated behind email
verification (OWASP WSTG-IDNT-04's only real mitigation is moving the disclosure into
the email channel). This change removes the outright disclosure; it does not make
sign-up non-enumerable. Recommend follow-up: enable `requireEmailVerification` with a
"check your email" screen.

Also confirmed and deliberately not changed: better-auth already rate-limits
`/sign-up*` at 3 requests / 10s in production by default
(`dist/api/rate-limiter/index.mjs:185-191`), so no custom rule is needed.

### Copy

The generic sign-up failure message must (a) not confirm or deny an account, (b) still
give a real user a way forward. The page already carries a permanent "Already have an
account? Sign in" footer link, so the message itself does not need to imply existence.

| Key                            | en                                                                                | es-MX                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SignUp.errors.signUpFailed`   | `We couldn’t create your account. Check your details and try again, or sign in if you already have one.` | `No pudimos crear tu cuenta. Revisa tus datos e inténtalo de nuevo, o inicia sesión si ya tienes una.` |
| `SignUp.errors.rateLimited`    | `Too many attempts. Wait a minute and try again.`                                  | `Demasiados intentos. Espera un minuto e inténtalo de nuevo.`                              |
| `SignIn.errors.invalidCredentials` | `Incorrect email or password.`                                                 | `Correo o contraseña incorrectos.`                                                         |
| `SignIn.errors.rateLimited`    | `Too many attempts. Wait a minute and try again.`                                  | `Demasiados intentos. Espera un minuto e inténtalo de nuevo.`                              |

Curly apostrophes (`’`) per the repo's content rules. Existing keys stay untouched.

---

## Global Constraints

- Never render `error.message` from better-auth in any UI. All copy comes from
  `messages/en.json` / `messages/es-MX.json` via `useTranslations`.
- Every new string must exist in **both** `messages/en.json` and `messages/es-MX.json`
  under the same key path.
- Use `’` (curly apostrophe) and `…` (ellipsis character) in copy, matching the
  existing `ForgotPassword` / `ResetPassword` entries.
- better-auth version is pinned at **1.6.9**. Any claim about its behavior must be
  checked against `node_modules/better-auth/dist/…`, not from memory.
- The server guard must **fail open**: if the existence lookup throws, log and let
  better-auth handle the request normally. A broken signup is worse than a marginal
  disclosure.
- Do not change `emailAndPassword.requireEmailVerification`.
- Do not add Claude/AI attribution to any commit message.
- Verification commands (run from the worktree root):
  `pnpm typecheck`, `pnpm lint`, `pnpm test`.

---

## File Structure

| File                                            | Responsibility                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `lib/auth-errors.ts` (new)                      | Pure mapping: better-auth client error → i18n message key. Never reads `.message`. |
| `lib/signup-enumeration-guard.ts` (new)         | Pure server guard: throws a neutral `APIError` when the email already exists.      |
| `lib/auth.ts` (modify)                          | Wires the guard in as `hooks.before` for `/sign-up/email`.                          |
| `app/[locale]/(auth)/sign-up/page.tsx` (modify) | Uses `signUpErrorKey` instead of `result.error.message`.                            |
| `app/[locale]/(auth)/sign-in/page.tsx` (modify) | Uses `signInErrorKey` instead of `result.error.message`.                            |
| `messages/en.json`, `messages/es-MX.json`       | New error copy.                                                                     |
| `__tests__/lib/auth-errors.test.ts` (new)       | Mapper unit tests, including the real 422 duplicate payload.                        |
| `__tests__/lib/signup-enumeration-guard.test.ts` (new) | Guard unit tests: duplicate throws neutral, unknown passes, lookup failure fails open. |
| `__tests__/components/sign-up-page.test.tsx` (new) | Renders the page, mocks a duplicate-email response, asserts the leak is gone.     |
| `__tests__/components/sign-in-page.test.tsx` (new) | Same for sign-in.                                                                  |
| `e2e/signup.spec.ts` (modify)                   | End-to-end: signing up with the seeded address shows generic copy only.             |

---

### Task 1: Client error mapper + copy

**Files:**

- Create: `lib/auth-errors.ts`
- Create: `__tests__/lib/auth-errors.test.ts`
- Modify: `messages/en.json` (`Auth.SignUp.errors`, `Auth.SignIn.errors`)
- Modify: `messages/es-MX.json` (same two objects)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type AuthClientError = { status?: number; code?: string; message?: string } | null | undefined`
  - `signUpErrorKey(error: AuthClientError): 'rateLimited' | 'signUpFailed'`
  - `signInErrorKey(error: AuthClientError): 'rateLimited' | 'invalidCredentials' | 'unexpectedError'`
  - Both return keys relative to `Auth.SignUp.errors` / `Auth.SignIn.errors`, so callers
    write `t(\`errors.${signUpErrorKey(result.error)}\`)`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/auth-errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signUpErrorKey, signInErrorKey } from '@/lib/auth-errors';

// The exact payload better-auth 1.6.9 returns for a duplicate sign-up
// (dist/api/routes/sign-up.mjs:205). Rendering `message` here is the bug.
const DUPLICATE_EMAIL_ERROR = {
  status: 422,
  code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
  message: 'User already exists. Use another email.',
};

describe('signUpErrorKey', () => {
  it('maps a duplicate-email error to the generic failure key', () => {
    expect(signUpErrorKey(DUPLICATE_EMAIL_ERROR)).toBe('signUpFailed');
  });

  it('maps an unrelated server failure to the same generic key', () => {
    // Indistinguishable on purpose: a distinct key would re-create the oracle.
    expect(signUpErrorKey({ status: 422, code: 'FAILED_TO_CREATE_USER' })).toBe('signUpFailed');
    expect(signUpErrorKey({ status: 500 })).toBe('signUpFailed');
    expect(signUpErrorKey(null)).toBe('signUpFailed');
    expect(signUpErrorKey(undefined)).toBe('signUpFailed');
  });

  it('surfaces rate limiting separately', () => {
    expect(signUpErrorKey({ status: 429, message: 'Too many requests' })).toBe('rateLimited');
  });
});

describe('signInErrorKey', () => {
  it('maps any 4xx credential rejection to one message', () => {
    expect(signInErrorKey({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'invalidCredentials'
    );
    expect(signInErrorKey({ status: 404, code: 'USER_NOT_FOUND' })).toBe('invalidCredentials');
  });

  it('surfaces rate limiting separately', () => {
    expect(signInErrorKey({ status: 429 })).toBe('rateLimited');
  });

  it('falls back to the unexpected-error key for server failures', () => {
    expect(signInErrorKey({ status: 500 })).toBe('unexpectedError');
    expect(signInErrorKey(null)).toBe('unexpectedError');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/lib/auth-errors.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth-errors`.

- [ ] **Step 3: Write the implementation**

Create `lib/auth-errors.ts`:

```ts
/**
 * better-auth error objects -> i18n message keys.
 *
 * The auth pages used to render `result.error.message` directly, which printed
 * better-auth's "User already exists. Use another email." on the public sign-up
 * form — a free account-existence oracle, and untranslated English on a
 * localized page. Nothing here reads `.message`: upstream copy must never reach
 * the screen.
 *
 * Every server-side sign-up failure deliberately maps to the SAME key. Giving
 * the duplicate-email case its own message would just rebuild the oracle in our
 * own words.
 */

export type AuthClientError =
  | { status?: number; code?: string; message?: string }
  | null
  | undefined;

export type SignUpErrorKey = 'rateLimited' | 'signUpFailed';
export type SignInErrorKey = 'rateLimited' | 'invalidCredentials' | 'unexpectedError';

function isRateLimited(error: AuthClientError): boolean {
  return error?.status === 429;
}

export function signUpErrorKey(error: AuthClientError): SignUpErrorKey {
  return isRateLimited(error) ? 'rateLimited' : 'signUpFailed';
}

export function signInErrorKey(error: AuthClientError): SignInErrorKey {
  if (isRateLimited(error)) return 'rateLimited';
  const status = error?.status;
  // better-auth answers both "no such user" and "wrong password" with
  // INVALID_EMAIL_OR_PASSWORD, so one message covers every client-side
  // rejection without narrowing which half failed.
  if (typeof status === 'number' && status >= 400 && status < 500) return 'invalidCredentials';
  return 'unexpectedError';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/lib/auth-errors.test.ts`
Expected: PASS (9 assertions across 6 tests).

- [ ] **Step 5: Add the copy to both locale files**

In `messages/en.json`, `Auth.SignUp.errors` becomes:

```json
"errors": {
  "weakPassword": "Password must be at least 8 characters",
  "signUpFailed": "We couldn’t create your account. Check your details and try again, or sign in if you already have one.",
  "rateLimited": "Too many attempts. Wait a minute and try again.",
  "unexpectedError": "An unexpected error occurred",
  "googleSignUpFailed": "Failed to sign up with Google"
}
```

and `Auth.SignIn.errors`:

```json
"errors": {
  "invalidCredentials": "Incorrect email or password.",
  "rateLimited": "Too many attempts. Wait a minute and try again.",
  "unexpectedError": "An unexpected error occurred",
  "googleSignInFailed": "Failed to sign in with Google"
}
```

In `messages/es-MX.json`, `Auth.SignUp.errors`:

```json
"errors": {
  "weakPassword": "La contraseña debe tener al menos 8 caracteres",
  "signUpFailed": "No pudimos crear tu cuenta. Revisa tus datos e inténtalo de nuevo, o inicia sesión si ya tienes una.",
  "rateLimited": "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
  "unexpectedError": "Ocurrió un error inesperado",
  "googleSignUpFailed": "No se pudo registrar con Google"
}
```

and `Auth.SignIn.errors`:

```json
"errors": {
  "invalidCredentials": "Correo o contraseña incorrectos.",
  "rateLimited": "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
  "unexpectedError": "Ocurrió un error inesperado",
  "googleSignInFailed": "No se pudo iniciar sesión con Google"
}
```

- [ ] **Step 6: Verify both locale files still parse and have matching keys**

Run:

```bash
node -e "
const en=require('./messages/en.json'), es=require('./messages/es-MX.json');
for (const ns of ['SignUp','SignIn']) {
  const a=Object.keys(en.Auth[ns].errors).sort(), b=Object.keys(es.Auth[ns].errors).sort();
  if (JSON.stringify(a)!==JSON.stringify(b)) { console.error(ns,'MISMATCH',a,b); process.exit(1); }
  console.log(ns,'ok',a.join(','));
}"
```

Expected: `SignUp ok …` and `SignIn ok …`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/auth-errors.ts __tests__/lib/auth-errors.test.ts messages/en.json messages/es-MX.json
git commit -m "Add non-enumerating auth error mapper and copy"
```

---

### Task 2: Sign-up page stops rendering upstream errors

**Files:**

- Modify: `app/[locale]/(auth)/sign-up/page.tsx` (the `handleEmailSignUp` error branch, ~line 60)
- Create: `__tests__/components/sign-up-page.test.tsx`

**Interfaces:**

- Consumes: `signUpErrorKey` from `@/lib/auth-errors` (Task 1), keys
  `Auth.SignUp.errors.signUpFailed` / `.rateLimited`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/sign-up-page.test.tsx`. Note the mock ordering
convention used elsewhere in this directory: `vi.mock` calls first, component import
last.

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signUpEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  signIn: { social: vi.fn() },
}));

vi.mock('posthog-js', () => ({
  default: { identify: vi.fn(), capture: vi.fn() },
}));

vi.mock('@/lib/google-ads', () => ({
  fireSignupConversion: vi.fn(),
  setPendingSignupConversion: vi.fn(),
  clearPendingSignupConversion: vi.fn(),
}));

vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => null,
}));

// Render the real English copy so the test proves what a user actually sees.
vi.mock('next-intl', async () => {
  const en = (await import('@/messages/en.json')).default as Record<string, never>;
  return {
    useLocale: () => 'en',
    useTranslations: (namespace: string) => {
      const t = (key: string) =>
        key
          .split('.')
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)?.[part],
            namespace.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en)
          ) ?? key;
      return t as unknown as (key: string) => string;
    },
  };
});

import SignUpPage from '@/app/[locale]/(auth)/sign-up/page';

// The exact shape better-auth 1.6.9 returns for a duplicate sign-up.
const DUPLICATE_EMAIL_RESULT = {
  data: null,
  error: {
    status: 422,
    code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
    message: 'User already exists. Use another email.',
  },
};

async function submitSignUp() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taken@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'TestPassword123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sign-up page error handling', () => {
  it('never renders better-auth’s account-existence message', async () => {
    signUpEmail.mockResolvedValue(DUPLICATE_EMAIL_RESULT);
    render(<SignUpPage />);
    await submitSignUp();

    await waitFor(() => {
      expect(screen.getByText(/we couldn’t create your account/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/use another email/i)).not.toBeInTheDocument();
  });

  it('shows the same message for an unrelated server failure', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Internal Server Error' },
    });
    render(<SignUpPage />);
    await submitSignUp();

    await waitFor(() => {
      expect(screen.getByText(/we couldn’t create your account/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();
  });

  it('shows the rate-limit message on 429', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    render(<SignUpPage />);
    await submitSignUp();

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/components/sign-up-page.test.tsx`
Expected: FAIL — the page renders "User already exists. Use another email." so
`queryByText(/already exists/i)` finds a node.

- [ ] **Step 3: Fix the page**

In `app/[locale]/(auth)/sign-up/page.tsx`, add the import next to the other `@/lib`
imports:

```tsx
import { signUpErrorKey } from '@/lib/auth-errors';
```

and replace the error branch inside `handleEmailSignUp`:

```tsx
      if (result.error) {
        // Never render result.error.message: better-auth answers a duplicate
        // email with "User already exists. Use another email.", which turns this
        // public form into an account-existence oracle. Every server-side
        // failure collapses to one message; the permanent "Already have an
        // account? Sign in" link below is the recovery path.
        setError(t(`errors.${signUpErrorKey(result.error)}`));
      } else {
```

Also give the error paragraph a live region, matching `forgot-password/page.tsx`:

```tsx
            {error && (
              <p role="alert" aria-live="polite" className="text-sm text-destructive text-center">
                {error}
              </p>
            )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/components/sign-up-page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/'[locale]'/'(auth)'/sign-up/page.tsx __tests__/components/sign-up-page.test.tsx
git commit -m "Stop sign-up page from leaking account existence"
```

---

### Task 3: Sign-in page stops rendering upstream errors

**Files:**

- Modify: `app/[locale]/(auth)/sign-in/page.tsx` (error branch, ~line 56)
- Create: `__tests__/components/sign-in-page.test.tsx`

**Interfaces:**

- Consumes: `signInErrorKey` from `@/lib/auth-errors` (Task 1), keys
  `Auth.SignIn.errors.invalidCredentials` / `.rateLimited` / `.unexpectedError`.
- Produces: nothing for later tasks.

Read the file before editing. Notes from reading it already: it imports only
`signIn` from `@/lib/auth-client` (no `signUp`), does **not** import
`@/lib/google-ads`, and reads `useSearchParams()` for `?callbackUrl=` and
`?reset=success` — the shared `vitest.setup.ts` already mocks that hook to return
`{ get: vi.fn() }`, so both features are inert in tests. Its error paragraph is at
roughly line 177.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/sign-in-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signInEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: (...args: unknown[]) => signInEmail(...args), social: vi.fn() },
}));

vi.mock('posthog-js', () => ({
  default: { identify: vi.fn(), capture: vi.fn() },
}));

vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => null,
}));

vi.mock('next-intl', async () => {
  const en = (await import('@/messages/en.json')).default as Record<string, never>;
  return {
    useLocale: () => 'en',
    useTranslations: (namespace: string) => {
      const t = (key: string) =>
        key
          .split('.')
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)?.[part],
            namespace.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en)
          ) ?? key;
      return t as unknown as (key: string) => string;
    },
  };
});

import SignInPage from '@/app/[locale]/(auth)/sign-in/page';

async function submitSignIn() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'whatever123' } });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sign-in page error handling', () => {
  it('renders localized copy instead of the upstream message', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
    });
    render(<SignInPage />);
    await submitSignIn();

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });
  });

  it('does not distinguish an unknown account from a wrong password', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' },
    });
    render(<SignInPage />);
    await submitSignIn();

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/components/sign-in-page.test.tsx`
Expected: FAIL — page renders "Invalid email or password" / "User not found".

- [ ] **Step 3: Fix the page**

Add the import:

```tsx
import { signInErrorKey } from '@/lib/auth-errors';
```

Replace the error branch:

```tsx
      if (result.error) {
        // Localized, and identical for "no such account" and "wrong password" —
        // see lib/auth-errors.ts. Never render result.error.message.
        setError(t(`errors.${signInErrorKey(result.error)}`));
      } else {
```

Give the error paragraph the same `role="alert" aria-live="polite"` treatment and
`text-destructive` class used on the sign-up page.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/components/sign-in-page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/'[locale]'/'(auth)'/sign-in/page.tsx __tests__/components/sign-in-page.test.tsx
git commit -m "Stop sign-in page from rendering upstream auth errors"
```

---

### Task 4: Server-side guard — the phrase never leaves the API

**Files:**

- Create: `lib/signup-enumeration-guard.ts`
- Create: `__tests__/lib/signup-enumeration-guard.test.ts`
- Modify: `lib/auth.ts` (add a `hooks` block to the `betterAuth({...})` options)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:

  ```ts
  export const GENERIC_SIGN_UP_ERROR_CODE = 'UNABLE_TO_CREATE_ACCOUNT';
  export type FindUserByEmail = (
    email: string
  ) => Promise<{ user?: unknown } | null | undefined>;
  export function assertSignUpEmailIsAvailable(
    email: unknown,
    findUserByEmail: FindUserByEmail
  ): Promise<void>;
  ```

Verified against better-auth 1.6.9 before writing this task:
`hooks.before` is a single global `AuthMiddleware` matched against every path
(`dist/api/to-auth-endpoints.mjs:268-274`), so the handler filters on `ctx.path`.
`APIError` and `createAuthMiddleware` are both exported from `better-auth/api`
(`dist/api/index.mjs:216`), and the throwing form is
`APIError.from(status, { code, message })`. `ctx.context.internalAdapter.findUserByEmail`
exists on the hook context (`dist/context/create-context.mjs:191`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/signup-enumeration-guard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  assertSignUpEmailIsAvailable,
  GENERIC_SIGN_UP_ERROR_CODE,
} from '@/lib/signup-enumeration-guard';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('assertSignUpEmailIsAvailable', () => {
  it('lets an unused address through', async () => {
    const find = vi.fn().mockResolvedValue(null);
    await expect(assertSignUpEmailIsAvailable('new@example.com', find)).resolves.toBeUndefined();
    expect(find).toHaveBeenCalledWith('new@example.com');
  });

  it('lowercases the address before looking it up, matching better-auth', async () => {
    const find = vi.fn().mockResolvedValue(null);
    await assertSignUpEmailIsAvailable('  New@Example.COM ', find);
    expect(find).toHaveBeenCalledWith('new@example.com');
  });

  it('throws a neutral error for an address that already has an account', async () => {
    const find = vi.fn().mockResolvedValue({ user: { id: 'u1' } });
    const error = await assertSignUpEmailIsAvailable('taken@example.com', find).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.body?.code).toBe(GENERIC_SIGN_UP_ERROR_CODE);
    // The whole point: the response must not name the cause.
    expect(JSON.stringify(error.body)).not.toMatch(/already exists/i);
    expect(JSON.stringify(error.body)).not.toMatch(/another email/i);
  });

  it('ignores a non-string or empty email and lets better-auth validate', async () => {
    const find = vi.fn();
    await expect(assertSignUpEmailIsAvailable(undefined, find)).resolves.toBeUndefined();
    await expect(assertSignUpEmailIsAvailable('   ', find)).resolves.toBeUndefined();
    await expect(assertSignUpEmailIsAvailable(42, find)).resolves.toBeUndefined();
    expect(find).not.toHaveBeenCalled();
  });

  it('fails open when the lookup throws', async () => {
    const find = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(assertSignUpEmailIsAvailable('a@example.com', find)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/lib/signup-enumeration-guard.test.ts`
Expected: FAIL — cannot resolve `@/lib/signup-enumeration-guard`.

- [ ] **Step 3: Write the implementation**

Create `lib/signup-enumeration-guard.ts`:

```ts
import { APIError } from 'better-auth/api';

/**
 * Neutral replacement for better-auth's duplicate-signup error.
 *
 * better-auth 1.6.9 answers a sign-up for an existing address with
 * USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL and the plaintext message
 * "User already exists. Use another email."
 * (dist/api/routes/sign-up.mjs:205). Its own generic response — a synthetic
 * user plus a decoy password hash — is gated behind
 * `emailAndPassword.requireEmailVerification` (sign-up.mjs:160), which this app
 * disables so that signup can auto-sign-in and land on /start.
 *
 * So we intercept first and answer with a code that names nothing. This removes
 * the outright disclosure from the response body; it does NOT make sign-up
 * non-enumerable — a duplicate still returns 422 where a fresh address returns
 * 200 with a session. Closing that gap requires gating sign-up behind email
 * verification, which is a product change.
 *
 * Deliberately no decoy password hash: with the status codes still differing,
 * timing equalization buys nothing, and hashing on the duplicate path would let
 * an attacker force scrypt work with every request.
 */
export const GENERIC_SIGN_UP_ERROR_CODE = 'UNABLE_TO_CREATE_ACCOUNT';

const GENERIC_SIGN_UP_ERROR_MESSAGE = 'Unable to create an account with the details provided.';

export type FindUserByEmail = (email: string) => Promise<{ user?: unknown } | null | undefined>;

export async function assertSignUpEmailIsAvailable(
  email: unknown,
  findUserByEmail: FindUserByEmail
): Promise<void> {
  if (typeof email !== 'string') return;
  // better-auth lowercases before its own lookup (sign-up.mjs:163); match it or
  // the guard misses "Taken@Example.com".
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  let existing: Awaited<ReturnType<FindUserByEmail>>;
  try {
    existing = await findUserByEmail(normalized);
  } catch (error) {
    // Fail open. A signup outage is worse than the disclosure this guard
    // removes — better-auth still handles the request, just less quietly.
    console.error('[auth] sign-up existence check failed', error);
    return;
  }

  if (existing?.user) {
    throw APIError.from('UNPROCESSABLE_ENTITY', {
      code: GENERIC_SIGN_UP_ERROR_CODE,
      message: GENERIC_SIGN_UP_ERROR_MESSAGE,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/lib/signup-enumeration-guard.test.ts`
Expected: PASS (5 tests). If `error.body` is undefined, inspect the thrown object
(`console.log(Object.keys(error))`) and assert on the field better-call actually
populates — do not weaken the "must not contain 'already exists'" assertions.

- [ ] **Step 5: Wire the guard into `lib/auth.ts`**

Add to the imports at the top:

```ts
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { assertSignUpEmailIsAvailable } from '@/lib/signup-enumeration-guard';
```

(`APIError` is only needed if the file does not already import it — check first and
skip the unused import if so; `pnpm lint` will fail on an unused binding.)

Add a `hooks` block to the `betterAuth({ ... })` options, next to `advanced`:

```ts
  hooks: {
    // `hooks.before` is a single global middleware in better-auth 1.6.9 — it runs
    // for every endpoint, so filter by path (dist/api/to-auth-endpoints.mjs:268).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      const body = ctx.body as { email?: unknown } | undefined;
      await assertSignUpEmailIsAvailable(body?.email, (email) =>
        ctx.context.internalAdapter.findUserByEmail(email)
      );
    }),
  },
```

- [ ] **Step 6: Verify the wiring type-checks and nothing else broke**

Run: `pnpm typecheck && pnpm vitest run __tests__/lib/auth-first-board-hook.test.ts`
Expected: typecheck clean; the existing first-board hook tests still pass.

If `ctx.context.internalAdapter.findUserByEmail` returns a type that does not satisfy
`FindUserByEmail`, widen `FindUserByEmail`'s return to match what better-auth declares
rather than casting at the call site.

- [ ] **Step 7: Commit**

```bash
git add lib/signup-enumeration-guard.ts __tests__/lib/signup-enumeration-guard.test.ts lib/auth.ts
git commit -m "Return a neutral error for duplicate sign-up attempts"
```

---

### Task 5: End-to-end coverage and full verification

**Files:**

- Modify: `e2e/signup.spec.ts`

**Interfaces:**

- Consumes: the copy from Task 1 and the page change from Task 2.
- Produces: nothing.

The e2e suite provisions a throwaway Neon branch and seeds `e2etest@example.com`
(`scripts/e2e-run.ts`, `scripts/e2e-seed-user.ts`), so that address is guaranteed to
already exist during a run. `test.use({ storageState: { cookies: [], origins: [] } })`
at the top of the file already makes these tests anonymous.

- [ ] **Step 1: Add the failing e2e test**

Append inside the existing `test.describe('sign up', …)` block in `e2e/signup.spec.ts`:

```ts
  test('signing up with an address that already has an account reveals nothing', async ({
    page,
  }) => {
    await page.goto('/sign-up');

    await page.locator('#name').fill('Impostor');
    // Seeded by scripts/e2e-seed-user.ts, so this address always exists.
    await page.locator('#email').fill('e2etest@example.com');
    await page.locator('#password').fill('SomeOtherPassword123!');

    await page.getByRole('button', { name: /sign up|create account/i }).click();

    await expect(page.getByText(/we couldn’t create your account/i)).toBeVisible({
      timeout: 15_000,
    });
    // The response must not name the cause, anywhere on the page.
    await expect(page.getByText(/already exists/i)).toHaveCount(0);
    await expect(page.getByText(/another email/i)).toHaveCount(0);
    // And we must not have signed anyone in or navigated away.
    await expect(page).toHaveURL(/\/(en\/)?sign-up/);
  });
```

- [ ] **Step 2: Confirm the whole unit suite is green**

Run: `pnpm test`
Expected: PASS. Note the repo gotcha — `.worktrees/**` is already excluded in
`vitest.config.ts`, so a stale sibling worktree cannot pollute the run.

- [ ] **Step 3: Typecheck, lint, format**

Run: `pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all clean. If `format:check` complains, run `pnpm format` and re-check.

- [ ] **Step 4: Try the e2e signup specs**

Run: `pnpm test:e2e -- e2e/signup.spec.ts` (or the suite's nearest equivalent — read
`scripts/e2e-run.ts` for how it forwards arguments).
Expected: both sign-up tests pass.

This step needs Neon credentials and `.env.test`. If it cannot run in this
environment, say so explicitly in the final report — do not report it as passing, and
do not delete the test.

- [ ] **Step 5: Commit**

```bash
git add e2e/signup.spec.ts
git commit -m "Add e2e coverage for non-enumerating sign-up errors"
```

---

## Self-Review

**Spec coverage**

| Spec requirement                                  | Task    |
| ------------------------------------------------- | ------- |
| Page never renders an upstream error string        | 2 (and 3 for sign-in) |
| All server-side sign-up failures share one message | 1 (mapper), 2 (wiring) |
| API stops emitting "User already exists"           | 4       |
| Sign-in gets the same treatment                    | 3       |
| Copy exists in en and es-MX                        | 1, step 5-6 |
| Residual risk disclosed                            | Spec § Scope + code comment in `lib/signup-enumeration-guard.ts` + PR body |
| `requireEmailVerification` untouched               | Global Constraints |

**Placeholders:** none — every step carries the literal code or command.

**Type consistency:** `signUpErrorKey` / `signInErrorKey` are defined in Task 1 and
used with those exact names in Tasks 2 and 3. `assertSignUpEmailIsAvailable` and
`FindUserByEmail` are defined and consumed within Task 4. The i18n key names
(`signUpFailed`, `rateLimited`, `invalidCredentials`, `unexpectedError`) match between
Task 1's JSON and the `t(\`errors.${…}\`)` call sites.
