import { describe, expect, it } from "vitest";
import { domainError, errorMessage } from "./errors";

describe("errorMessage", () => {
  it("returns an Error's message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies a non-Error thrown value", () => {
    expect(errorMessage("boom")).toBe("boom");
    expect(errorMessage(42)).toBe("42");
  });
});

describe("domainError", () => {
  const ExampleError = domainError("ExampleError", "Couldn't do the thing.");

  it("builds an Error subclass carrying the given message", () => {
    const err = new ExampleError("underlying");
    expect(err).toBeInstanceOf(ExampleError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Couldn't do the thing.");
    expect(errorMessage(err)).toBe("Couldn't do the thing.");
  });

  it("keeps the underlying cause for diagnosis", () => {
    const cause = new Error("supabase said no");
    expect(new ExampleError(cause).cause).toBe(cause);
  });

  // Both readings of the name matter: `.name` on the instance is what Sentry
  // serialises, and the class's own `.name` (hence `constructor.name`) is what
  // a hand-written `class ExampleError extends Error` would have given.
  it("names the instance and the class itself", () => {
    const err = new ExampleError("underlying");
    expect(err.name).toBe("ExampleError");
    expect(err.constructor.name).toBe("ExampleError");
    expect(ExampleError.name).toBe("ExampleError");
    expect(String(err)).toBe("ExampleError: Couldn't do the thing.");
  });

  it("gives each call its own class, so instanceof discriminates", () => {
    const OtherError = domainError("OtherError", "Something else.");
    expect(new ExampleError("x")).not.toBeInstanceOf(OtherError);
    expect(new OtherError("x")).not.toBeInstanceOf(ExampleError);
  });
});
