import type { ReactNode } from "react";

export function WidgetCard(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`app-card ${props.className ?? ""}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-medium text-app-text">{props.title}</h2>
          {props.subtitle ? <p className="text-xs text-app-text-muted mt-0.5">{props.subtitle}</p> : null}
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}
