import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermsOfService from "./page";

describe("TermsOfService", () => {
  it("renders the terms heading and a link back to the editor", () => {
    render(<TermsOfService />);
    expect(
      screen.getByRole("heading", { name: /terms of service/i }),
    ).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to the editor/i });
    expect(backLink).toHaveAttribute("href", "/");
  });
});
