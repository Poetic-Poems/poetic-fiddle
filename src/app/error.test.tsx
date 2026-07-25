import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./error";
import { MISSING_SUPABASE_ENV_MESSAGE } from "@/lib/env-errors";

describe("root error boundary", () => {
  it("shows an actionable message when Supabase env vars are missing", () => {
    render(
      <ErrorBoundary
        error={new Error(MISSING_SUPABASE_ENV_MESSAGE)}
        reset={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /supabase isn.t configured/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\.env\.example/)).toBeInTheDocument();
    expect(screen.getByText(/\.env\.local/)).toBeInTheDocument();
  });

  it("shows a generic message for any other error", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\.env\.example/)).not.toBeInTheDocument();
  });
});
