import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the landing heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /a friendly home for your poems/i }),
    ).toBeInTheDocument();
  });
});
