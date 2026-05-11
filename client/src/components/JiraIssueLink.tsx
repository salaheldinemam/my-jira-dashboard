import { useUiStore } from "../store";

type JiraIssueLinkProps = {
  issueKey: string;
  text?: string;
  className?: string;
};

export function JiraIssueLink({ issueKey, text, className }: JiraIssueLinkProps) {
  const jiraBaseUrl = useUiStore((s) => s.jiraBaseUrl);
  const href = jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(issueKey)}` : null;
  const label = text ?? issueKey;

  if (!href) {
    return <span className={className}>{label}</span>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  );
}
