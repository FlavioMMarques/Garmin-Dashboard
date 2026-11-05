import { useEffect } from "react";
import { useHashRoute } from "./useHashRoute";
import { useSettings } from "./api/settings";
import { SettingsPage } from "./pages/SettingsPage";
import { useProfile } from "./api/profile";
import { ProfileBadge } from "./components/ProfileBadge";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { RunningPage } from "./pages/RunningPage";
import { DailyPage } from "./pages/DailyPage";
import { SleepPage } from "./pages/SleepPage";
import { TrendsPage } from "./pages/TrendsPage";

const PAGES = {
  corrida: { label: "Corrida", Component: RunningPage },
  tendencias: { label: "Tendências", Component: TrendsPage },
  atividades: { label: "Atividades", Component: ActivitiesPage },
  saude: { label: "Saúde diária", Component: DailyPage },
  sono: { label: "Sono", Component: SleepPage },
  configuracao: { label: "Configuração", Component: SettingsPage },
} as const;

type Route = keyof typeof PAGES;
const ROUTES = Object.keys(PAGES) as Route[];

export function App() {
  const route = useHashRoute(ROUTES, "corrida");
  const { Component } = PAGES[route];
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();

  // First run: without a key nothing else can load, so start at Configuração.
  useEffect(() => {
    if (settings?.configured === false && route !== "configuracao") {
      window.location.hash = "#/configuracao";
    }
  }, [settings?.configured, route]);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Garmin Dashboard</span>
        <nav aria-label="Seções">
          <ul className="tabs">
            {ROUTES.map((r) => (
              <li key={r}>
                <a href={`#/${r}`} aria-current={r === route ? "page" : undefined}>
                  {PAGES[r].label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ProfileBadge fullName={profile?.fullName} photoUrl={profile?.photoUrl} />
      </header>
      <main className="content">
        <Component />
      </main>
    </div>
  );
}
