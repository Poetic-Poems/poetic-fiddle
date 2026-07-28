interface PageHeaderProps {
  title: string;
  lastUpdated: string;
}

export function PageHeader({ title, lastUpdated }: PageHeaderProps) {
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-1 text-sm text-foreground/70">
        Last updated {lastUpdated}
      </p>
    </div>
  );
}
