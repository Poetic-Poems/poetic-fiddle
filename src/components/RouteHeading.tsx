import type { ReactNode } from "react";

interface RouteHeadingProps {
  title: string;
  description: ReactNode;
  headingId?: string;
  headingTabIndex?: number;
}

export function RouteHeading({
  title,
  description,
  headingId,
  headingTabIndex,
}: RouteHeadingProps) {
  return (
    <div className="px-6 pt-6">
      <h1
        id={headingId}
        tabIndex={headingTabIndex}
        className="font-serif text-2xl font-semibold tracking-tight"
      >
        {title}
      </h1>
      <p className="text-sm text-foreground/70">{description}</p>
    </div>
  );
}
