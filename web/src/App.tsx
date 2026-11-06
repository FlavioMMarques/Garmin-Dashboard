import { useEffect, type ReactNode } from "react";
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

/** Stroke icons (decorative: every link carries its label as text). */
const ICONS: Record<string, ReactNode> = {
  corrida: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="M4 22l4-7 3 2 2-5 4 3 3-1" />
      <path d="M9 9l3-2 3 3" />
    </>
  ),
  tendencias: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  atividades: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  saude: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
  ),
  sono: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  configuracao: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
};

function NavIcon({ route }: { route: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[route]}
    </svg>
  );
}

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
/** Data sections up top; Configuração sits apart, at the foot of the menu. */
const MAIN_ROUTES = ROUTES.filter((r) => r !== "configuracao");

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

  const navLink = (r: Route) => (
    <a href={`#/${r}`} aria-current={r === route ? "page" : undefined} className="nav-link">
      <NavIcon route={r} />
      {PAGES[r].label}
    </a>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h4l3-7 4 14 3-7h4" />
            </svg>
          </span>
          <span>
            <span className="brand-name">Garmin Dashboard</span>
            <span className="brand-tagline">Seus dados, no seu computador</span>
          </span>
        </div>
        <nav aria-label="Seções" className="sidebar-nav">
          <ul className="tabs">
            {MAIN_ROUTES.map((r) => (
              <li key={r}>{navLink(r)}</li>
            ))}
          </ul>
          <ul className="tabs tabs-footer">
            <li>{navLink("configuracao")}</li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <ProfileBadge fullName={profile?.fullName} photoUrl={profile?.photoUrl} />
          {settings && (
            <p className={`connection ${settings.configured ? "is-on" : "is-off"}`}>
              <span className="connection-dot" aria-hidden="true" />
              {settings.configured ? "Conectado à Garmin" : "Chave da Garmin não configurada"}
            </p>
          )}
        </div>
      </aside>
      <main className="content">
        <Component />
      </main>
    </div>
  );
}
