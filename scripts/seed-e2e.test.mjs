import { describe, expect, it } from "vitest";
import { ensureLocalSupabase, parseEnvOutput } from "./seed-e2e.mjs";

const STATUS_ENV_OUTPUT = `API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
STUDIO_URL="http://127.0.0.1:54323"
ANON_KEY="anon-key-value"
SERVICE_ROLE_KEY="service-role-key-value"
`;

describe("parseEnvOutput", () => {
  it('parses KEY="value" lines into an object', () => {
    expect(parseEnvOutput(STATUS_ENV_OUTPUT)).toEqual({
      API_URL: "http://127.0.0.1:54321",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      STUDIO_URL: "http://127.0.0.1:54323",
      ANON_KEY: "anon-key-value",
      SERVICE_ROLE_KEY: "service-role-key-value",
    });
  });

  it("ignores blank lines", () => {
    expect(parseEnvOutput('API_URL="http://x"\n\n\n')).toEqual({
      API_URL: "http://x",
    });
  });
});

describe("ensureLocalSupabase", () => {
  it("returns status vars when the instance is already running", () => {
    const run = (args) => {
      expect(args).toEqual(["status", "-o", "env"]);
      return STATUS_ENV_OUTPUT;
    };
    expect(ensureLocalSupabase({ run })).toEqual(
      parseEnvOutput(STATUS_ENV_OUTPUT),
    );
  });

  it("starts the instance when `status` fails", () => {
    const calls = [];
    const run = (args) => {
      calls.push(args);
      if (args[0] === "status") throw new Error("not running");
      return STATUS_ENV_OUTPUT;
    };
    expect(ensureLocalSupabase({ run })).toEqual(
      parseEnvOutput(STATUS_ENV_OUTPUT),
    );
    expect(calls).toEqual([
      ["status", "-o", "env"],
      ["start", "-o", "env"],
    ]);
  });

  it("throws naming whichever status variables are missing", () => {
    const run = () => 'API_URL="http://127.0.0.1:54321"\n';
    expect(() => ensureLocalSupabase({ run })).toThrow(
      /ANON_KEY, SERVICE_ROLE_KEY/,
    );
  });
});
