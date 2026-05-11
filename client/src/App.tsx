import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { TimeTrackingPage } from "./pages/TimeTrackingPage";
import { WorkloadPage } from "./pages/WorkloadPage";
import { TestingPage } from "./pages/TestingPage";
import { StoriesPage } from "./pages/StoriesPage";
import { QrLv3ProductionPage } from "./pages/QrLv3ProductionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { hasJiraSettings, loadJiraSettings } from "./jiraSettings";

function RequireJiraSettings() {
  const location = useLocation();
  const settings = loadJiraSettings();
  if (!hasJiraSettings(settings) && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route element={<RequireJiraSettings />}>
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
