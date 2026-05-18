export function StatCard(props: {
  title: string;
  value: number;
  suffix?: string;
  subtitle?: string;
  accent?: "default" | "warning" | "danger";
}) {
  const valueClass =
    props.accent === "danger"
      ? "text-rose-600 dark:text-rose-300"
      : props.accent === "warning"
        ? "text-amber-600 dark:text-amber-300"
        : "text-app-text";

  return (
    <div className="app-card p-4">
      <div className="text-xs uppercase tracking-wide text-app-text-muted">{props.title}</div>
      <div className={`text-3xl font-semibold mt-1 ${valueClass}`}>
        {props.value}
        {props.suffix ?? ""}
      </div>
      {props.subtitle ? <div className="text-xs text-app-text-muted mt-1">{props.subtitle}</div> : null}
    </div>
  );
}
