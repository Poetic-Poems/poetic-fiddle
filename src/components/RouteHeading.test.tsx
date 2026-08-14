import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteHeading } from "./RouteHeading";

describe("RouteHeading", () => {
  it("renders the title as a heading and the description", () => {
    render(
      <RouteHeading title="Write your poem" description="Edit and preview." />,
    );
    expect(
      screen.getByRole("heading", { name: "Write your poem" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Edit and preview.")).toBeInTheDocument();
  });

  it("passes an id and tabIndex through to the heading when given", () => {
    render(
      <RouteHeading
        title="My poems"
        description="Your saved drafts."
        headingId="poems-heading"
        headingTabIndex={-1}
      />,
    );
    const heading = screen.getByRole("heading", { name: "My poems" });
    expect(heading).toHaveAttribute("id", "poems-heading");
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("omits the id and tabIndex when not given", () => {
    render(<RouteHeading title="Remix this poem" description="A copy." />);
    const heading = screen.getByRole("heading", { name: "Remix this poem" });
    expect(heading).not.toHaveAttribute("id");
    expect(heading).not.toHaveAttribute("tabindex");
  });
});
