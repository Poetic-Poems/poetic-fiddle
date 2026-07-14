import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the editor heading and a syntax reference link", async () => {
    render(<Home />);
    expect(
      await screen.findByRole("heading", { name: /write your poem/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /syntax reference/i }),
    ).toBeInTheDocument();
  });
});
