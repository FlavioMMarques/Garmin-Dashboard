import { useMemo } from "react";
import { useDailyRange } from "../api/daily";
import { useProfile } from "../api/profile";
import { shiftDate } from "../lib/health";
import { generateHealthInsights } from "../lib/healthInsights";
import { weekStartsOnFrom } from "../lib/volume";
import { InsightsPanel } from "./InsightsPanel";

/** Days of history the chosen day is compared against. */
const HISTORY_DAYS = 30;

/** "O que o seu dia mostra": the chosen day against the user's previous 30 days. */
export function DayInsights({ date, today }: { date: string; today: string }) {
  const {
    data: days,
    error,
    isPending,
    isPlaceholderData,
  } = useDailyRange(shiftDate(date, -HISTORY_DAYS), date);
  const weekStartsOn = weekStartsOnFrom(useProfile().data?.firstDayOfWeek);

  const insights = useMemo(() => {
    const day = days?.at(-1);
    if (!day || day.date !== date) return [];
    return generateHealthInsights({ day, history: days!.slice(0, -1), today, weekStartsOn });
  }, [days, date, today, weekStartsOn]);

  return (
    <section aria-labelledby="day-insights-title" aria-busy={isPending || isPlaceholderData}>
      <h2 id="day-insights-title" className="section-title">
        O que o seu dia mostra
      </h2>
      {error ? (
        <p className="panel muted">Não foi possível carregar o histórico para comparar este dia.</p>
      ) : isPending ? (
        <div className="panel skeleton" style={{ height: "6rem" }} />
      ) : (
        <InsightsPanel
          insights={insights}
          emptyMessage="Ainda não há histórico suficiente para comparar este dia (são precisos 7 dias com dados do relógio nos 30 anteriores)."
        />
      )}
    </section>
  );
}
