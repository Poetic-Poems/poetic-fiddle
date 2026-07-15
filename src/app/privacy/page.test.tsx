import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPolicy from "./page";

describe("PrivacyPolicy", () => {
  it("renders the policy heading and a link back to the editor", () => {
    render(<PrivacyPolicy />);
    expect(
      screen.getByRole("heading", { name: /privacy policy/i }),
    ).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to the editor/i });
    expect(backLink).toHaveAttribute("href", "/");
  });
});
