import { useHashRoute } from "./useHashRoute";
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
} as const;

type Route = keyof typeof PAGES;
const ROUTES = Object.keys(PAGES) as Route[];

export function App() {
  const route = useHashRoute(ROUTES, "corrida");
  const { Component } = PAGES[route];

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
      </header>
      <main className="content">
        <Component />
      </main>
    </div>
  );
}
