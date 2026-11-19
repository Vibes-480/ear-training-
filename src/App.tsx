import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { DailyPage } from "./pages/DailyPage";
import { DictationPage } from "./pages/DictationPage";
import { DrillPage } from "./pages/DrillPage";
import { HomePage } from "./pages/HomePage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SingPage } from "./pages/SingPage";
import { useSettings } from "./store/settings";

export function App() {
  const { theme } = useSettings();
  const location = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/" end className="brand">
          Ear Trainer
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end>
            Practice
          </NavLink>
          <NavLink to="/progress">Progress</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/drill/:id" element={<DrillPage key={location.pathname} />} />
          <Route path="/sing" element={<SingPage />} />
          <Route path="/dictation" element={<DictationPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
