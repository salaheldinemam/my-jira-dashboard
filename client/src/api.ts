const base = "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Not connected to Jira. Open Settings and sign in with Atlassian.");
    }
    let err = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(err);
  }
  return res.json() as Promise<T>;
}
