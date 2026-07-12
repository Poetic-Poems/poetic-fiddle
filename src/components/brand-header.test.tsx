import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandHeader } from "./brand-header";

describe("BrandHeader", () => {
  it("renders the Poetic Fiddle wordmark", () => {
    render(<BrandHeader />);
    expect(screen.getByText("Poetic Fiddle")).toBeInTheDocument();
  });
});
