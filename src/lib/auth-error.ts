/**
 * Safe, user-facing text for Supabase Auth error codes (`AuthError.code`,
 * `@supabase/auth-js`'s `ErrorCode`) — same convention as the typed errors in
 * `poems-store.ts`: a message safe to show a poet as-is, with the raw
 * Supabase error kept as `.cause` for diagnosis rather than surfaced.
 */
const SAFE_MESSAGES: Record<string, string> = {
  invalid_credentials: "That email or password isn't right. Please try again.",
  user_already_exists:
    "An account with that email already exists — try signing in instead.",
  email_exists:
    "An account with that email already exists — try signing in instead.",
  identity_already_exists:
    "That account is already linked to a sign-in method.",
  weak_password: "That password is too weak — please choose a stronger one.",
  email_not_confirmed:
    "Please confirm your email before signing in — check your inbox.",
  email_address_invalid: "That doesn't look like a valid email address.",
  email_address_not_authorized: "That email address isn't allowed to sign in.",
  over_email_send_rate_limit:
    "Too many attempts — please wait a moment and try again.",
  over_request_rate_limit:
    "Too many attempts — please wait a moment and try again.",
  over_sms_send_rate_limit:
    "Too many attempts — please wait a moment and try again.",
  signup_disabled:
    "New sign-ups aren't available right now. Please try again later.",
  user_banned: "This account can't sign in right now.",
  same_password: "Your new password must be different from your current one.",
  captcha_failed: "That verification check failed — please try again.",
};

const DEFAULT_MESSAGE =
  "Something went wrong signing you in. Please try again.";

function safeMessage(cause: unknown): string {
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? (cause as { code?: unknown }).code
      : undefined;
  return (typeof code === "string" && SAFE_MESSAGES[code]) || DEFAULT_MESSAGE;
}

/**
 * A sign-in, sign-up, or OAuth call to Supabase Auth failed. `message` is
 * safe to show a poet as-is; the underlying Supabase `AuthError` is kept as
 * `cause` for diagnosis, since it can carry provider detail no reader needs.
 */
export class AuthError extends Error {
  constructor(cause: unknown) {
    super(safeMessage(cause));
    this.name = "AuthError";
    this.cause = cause;
  }
}
