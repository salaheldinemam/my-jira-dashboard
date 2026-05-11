# Jira Team Insights Dashboard

MVP full-stack app for engineering managers: workload, time tracking, testing pipeline, and stories-backed by your Jira site through a small Node API. Status names are configurable so different workflows can be normalized to the same buckets (open, in progress, under testing, etc.).

## Stack

- **Frontend:** React 19, Vite, React Router, Zustand, Tailwind CSS 3
- **Backend:** Express, `express-session` (API token encrypted at rest in session with AES-256-GCM), in-memory cache (~60s)

## Quick start

1. **Environment**
  ```bash
   copy .env.example .env
  ```
   Set `SESSION_SECRET` to a strong random value.
   Optional: set `JIRA_STATUS_MAPPING_JSON` as a JSON string to override default status buckets.
2. **Install and run**
  ```bash
   npm install
   npm run dev
  ```
  - UI: [http://localhost:5173](http://localhost:5173) (proxies `/api` to the server)
  - API: [http://localhost:4000](http://localhost:4000)
3. **Use filters**
  Each page loads data only when you click its action button (for example, "Load summary" or "Load workload") after selecting filters.

## API surface (for tools or extension)


| Method | Path                        | Purpose                                                |
| ------ | --------------------------- | ------------------------------------------------------ |
| GET    | `/api/projects`             | Searchable project list                                |
| GET    | `/api/dashboard/summary`    | Home metrics + optional hours in range                 |
| GET    | `/api/time-tracking`        | Per-person hours and tasks (needs `from` / `to`)       |
| GET    | `/api/workload/by-assignee` | Workload buckets per person                            |
| GET    | `/api/testing`              | `view=underTesting` or `failedTesting`                 |
| GET    | `/api/stories`              | Stories + enhancements, grouped                        |
| POST   | `/api/jql`                  | Ad-hoc JQL search (advanced)                           |


## Production notes

- Serve the built client (`npm run build`) behind HTTPS; set `NODE_ENV=production` so session cookies are `secure`.
- Set `CLIENT_ORIGIN` to your SPA origin for strict CORS.
- Expect **Jira rate limits**; the server caches list responses briefly. Large sites may need Redis or longer-lived cache (optional).
- **Worklog search** uses Jira’s `worklogDate` JQL where supported; if your site uses different JQL rules, adjust `/api/time-tracking` or filter worklogs only in code.

## Deploy on Render (single service)

This repo is ready to deploy frontend + backend together on Render in one web service.

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint** and select this repo.
3. Render will detect `render.yaml` and create one Node web service.
4. Confirm environment variables:
   - `NODE_ENV=production` (already set in blueprint)
   - `SESSION_SECRET` (auto-generated in blueprint)
   - Optional `CLIENT_ORIGIN` (only needed if you want strict CORS; set to your Render URL or custom domain)
5. Trigger deploy.

Build and start commands used by Render:

- Build: `npm ci && npm run build`
- Start: `npm start`

Once deployed, open `https://<your-service>.onrender.com`, go to **Settings** in the app UI, and connect using your Jira base URL, email, and API token.

## PRD alignment


| Area                                  | Status                                                            |
| ------------------------------------- | ----------------------------------------------------------------- |
| API token auth + base URL             | Done via Settings page + server session                            |
| Multi-project selection               | Done                                                              |
| Home summary widgets                  | Done                                                              |
| Time tracking table + drill-down      | Done                                                              |
| Workload by assignee / status buckets | Done                                                              |
| Testing views                         | Done                                                              |
| Stories & enhancements                | Done                                                              |
| Configurable status mapping           | Done (defaults + optional `JIRA_STATUS_MAPPING_JSON`)             |
| Pagination / caps                     | Search capped with chunking; tune `maxCap` in `fetchAllIssues.ts` |


Not in this MVP: OAuth, Slack alerts, Redis, PostgreSQL, sprint picker UI, label/component filters (easy to add via JQL builder).

## License

Private / your org.