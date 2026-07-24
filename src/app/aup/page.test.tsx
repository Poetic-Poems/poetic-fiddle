import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AcceptableUsePolicy from "./page";

describe("AcceptableUsePolicy", () => {
  it("renders the AUP heading and a link back to the editor", () => {
    render(<AcceptableUsePolicy />);
    expect(
      screen.getByRole("heading", { name: /acceptable use policy/i }),
    ).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to the editor/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("links to the terms of service and privacy policy", () => {
    render(<AcceptableUsePolicy />);
    const links = screen.getAllByRole("link", {
      name: /terms of service/i,
    });
    expect(links.some((link) => link.getAttribute("href") === "/terms")).toBe(
      true,
    );
    const privacyLink = screen.getByRole("link", { name: /privacy policy/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });
});
