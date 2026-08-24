export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--da-purple)]">
          BeeFlow
        </p>
        <h1 className="bf-page-title mt-2">{title}</h1>
        {description ? (
          <p className="bf-page-sub">
            <span className="bf-italic">{description}</span>
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
