export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Builds a distinct `Error` subclass for one named domain failure: `message`
 * is safe to show a poet as-is, and the underlying cause (a Supabase/network
 * error, a missing session, a failed fetch) is kept as `.cause` for
 * diagnosis. Each call returns its own class, so `instanceof` and
 * `.name`/`.constructor.name` checks against a specific error (e.g.
 * `PoemSaveError`) behave exactly as they would for a hand-written subclass.
 */
export function domainError(
  name: string,
  message: string,
): new (cause: unknown) => Error {
  const DomainError = class extends Error {
    constructor(cause: unknown) {
      super(message);
      this.name = name;
      this.cause = cause;
    }
  };
  // A class expression built inside a function is anonymous, so its own static
  // `.name` — and hence `err.constructor.name` — would read as "" rather than
  // the name a hand-written `class PoemSaveError extends Error` gives. The
  // instance's `.name` is set above either way; this makes the *class* match
  // too, so error serialisers that reach for `constructor.name` see the same
  // string as before.
  Object.defineProperty(DomainError, "name", {
    value: name,
    configurable: true,
  });
  return DomainError;
}
