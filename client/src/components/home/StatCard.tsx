export function StatCard(props: {
  title: string;
  value: number;
  suffix?: string;
  subtitle?: string;
  accent?: "default" | "warning" | "danger";
}) {
  const valueClass =
    props.accent === "danger"
      ? "text-rose-300"
      : props.accent === "warning"
        ? "text-amber-200"
        : "text-white";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{props.title}</div>
      <div className={`text-3xl font-semibold mt-1 ${valueClass}`}>
        {props.value}
        {props.suffix ?? ""}
      </div>
      {props.subtitle ? <div className="text-xs text-slate-500 mt-1">{props.subtitle}</div> : null}
    </div>
  );
}
