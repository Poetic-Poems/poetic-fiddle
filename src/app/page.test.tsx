import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Home from "./page";
import { saveDraft } from "@/lib/draft-storage";

describe("Home", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the editor heading and a syntax reference link", async () => {
    render(<Home />);
    expect(
      await screen.findByRole("heading", { name: /write your poem/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /syntax reference/i }),
    ).toBeInTheDocument();
  });

  it("shows no sign-in prompt while editing (AC7)", async () => {
    render(<Home />);
    await screen.findByRole("link", { name: /syntax reference/i });
    expect(screen.queryByText(/sign in to/i)).not.toBeInTheDocument();
  });

  it("restores a stored anonymous draft on load (AC8)", async () => {
    saveDraft("not a valid poem at all");
    render(<Home />);
    expect(
      await screen.findByText(/couldn't parse the poem yet/i),
    ).toBeInTheDocument();
  });

  it("prompts to sign in only when Save or Share is attempted (AC10)", async () => {
    render(<Home />);
    await screen.findByRole("link", { name: /syntax reference/i });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/^sign in to save$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText(/^sign in to save$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(await screen.findByText(/^sign in to share$/i)).toBeInTheDocument();
  });
});
