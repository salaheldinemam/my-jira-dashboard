export type IssueRow = {
  key: string;
  summary: string;
  status: string;
  issuetype: string;
  assignee: string;
  assigneeAccountId?: string;
  reporter: string;
  reporterAccountId?: string;
  updated: string;
  duedate?: string | null;
  priority?: string;
  projectKey?: string;
  projectName?: string;
};

export type HomeDashboard = {
  user: { displayName?: string; email: string; accountId: string; avatarUrl?: string };
  counts: {
    open: number;
    inProgress: number;
    readyForTesting: number;
    underTesting: number;
    reopened: number;
    failedTesting: number;
    overdue: number;
    total: number;
  };
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  issues: IssueRow[];
  dueSoon: IssueRow[];
  overdue: IssueRow[];
  recentlyUpdated: IssueRow[];
  projects: { key: string; name: string; count: number }[];
  testing: { ready: IssueRow[]; under: IssueRow[]; failed: IssueRow[] };
  timeThisWeek: { totalHours: number; byDay: { date: string; hours: number }[] };
};

export type AuthMe = {
  connected: boolean;
  authMode?: "oauth" | "basic";
  baseUrl?: string;
  email?: string;
  displayName?: string;
  accountId?: string;
  avatarUrl?: string;
  oauthAvailable?: boolean;
};
