import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("links to the privacy policy", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /privacy policy/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/privacy");
  });
});
