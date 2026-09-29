import type { ReactNode } from "react";

interface RouteHeadingProps {
  title: string;
  description?: ReactNode;
  descriptionRole?: "status" | "alert";
  descriptionClassName?: string;
  headingId?: string;
  headingTabIndex?: number;
  /**
   * The default `<div className="px-6 pt-6">` wrapper suits a route whose
   * `<main>` carries no padding of its own. Pass `null` for a route that
   * renders this heading directly inside a `<main>` that already applies
   * its own padding, so that padding isn't doubled up.
   */
  wrapperClassName?: string | null;
}

export function RouteHeading({
  title,
  description,
  descriptionRole,
  descriptionClassName,
  headingId,
  headingTabIndex,
  wrapperClassName = "px-6 pt-6",
}: RouteHeadingProps) {
  const content = (
    <>
      <h1
        id={headingId}
        tabIndex={headingTabIndex}
        className="font-serif text-2xl font-semibold tracking-tight"
      >
        {title}
      </h1>
      {description !== undefined && (
        <p
          role={descriptionRole}
          className={descriptionClassName ?? "text-sm text-foreground/70"}
        >
          {description}
        </p>
      )}
    </>
  );

  if (wrapperClassName === null) return content;

  return <div className={wrapperClassName}>{content}</div>;
}
