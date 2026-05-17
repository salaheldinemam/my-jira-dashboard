import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { TimeTrackingPage } from "./pages/TimeTrackingPage";
import { WorkloadPage } from "./pages/WorkloadPage";
import { TestingPage } from "./pages/TestingPage";
import { StoriesPage } from "./pages/StoriesPage";
import { QrLv3ProductionPage } from "./pages/QrLv3ProductionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { api } from "./api";

function RequireJiraAuth() {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api<{ connected: boolean }>("/api/auth/me");
        if (alive) setConnected(me.connected);
      } catch {
        if (alive) setConnected(false);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!connected && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace />;
  }

  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route element={<RequireJiraAuth />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="time" element={<TimeTrackingPage />} />
          <Route path="workload" element={<WorkloadPage />} />
          <Route path="testing" element={<TestingPage />} />
          <Route path="stories" element={<StoriesPage />} />
          <Route path="qr-lv3" element={<QrLv3ProductionPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
