import type { ReactNode } from "react";

export function WidgetCard(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${props.className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">{props.title}</h2>
          {props.subtitle ? <p className="text-xs text-slate-500 mt-0.5">{props.subtitle}</p> : null}
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}
