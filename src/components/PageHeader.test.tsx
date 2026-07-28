import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the title as a heading and the last-updated date", () => {
    render(<PageHeader title="Privacy Policy" lastUpdated="27 July 2026" />);
    expect(
      screen.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last updated 27 July 2026")).toBeInTheDocument();
  });
});
