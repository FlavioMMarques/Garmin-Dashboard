import { useMemo, useState } from "react";
import { useWellness, type HealthDay } from "../api/wellness";
import { ErrorBanner } from "../components/ErrorBanner";
import { InsightsPanel } from "../components/InsightsPanel";
import { StatTile } from "../components/StatTile";
import { percentDelta } from "../lib/delta";
import { formatTotalTime } from "../lib/format";
import { baseline, dailyInsights } from "../lib/healthInsights";
import { toIsoDate } from "../lib/runStats";

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const VS = "vs sua mediana de 30 dias";

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const time = (local: string | null) => local?.slice(11, 16) ?? "—";

export function DailyPage({ today = new Date() }: { today?: Date }) {
  const todayIso = toIsoDate(today);
  const [date, setDate] = useState(todayIso);
  // The day plus the 30 before it, so every number can be compared with the user's norm.
  const { data, error, isPending, isPlaceholderData, refetch } = useWellness(
    shiftDay(date, -30),
    date,
  );
  const days = useMemo(() => data ?? [], [data]);
  const day = days.find((d) => d.date === date);
  const inProgress = date === todayIso;
  const insights = useMemo(
    () => dailyInsights(days, date, { inProgress }),
    [days, date, inProgress],
  );
  const base = (pick: (d: HealthDay) => number | null | undefined) => baseline(days, date, pick);
  const delta = (cur: number | null | undefined, b: number | null, upIsGood = true) =>
    cur != null && b != null ? percentDelta(cur, b, upIsGood) : null;
  const hasData = day && (day.steps != null || day.sleep || day.restingHr != null);

  return (
    <section>
      <h1>Saúde diária</h1>

      <div className="toolbar" role="group" aria-label="Dia">
        <button type="button" onClick={() => setDate(shiftDay(date, -1))}>
          ← Dia anterior
        </button>
        <input
          type="date"
          aria-label="Escolher dia"
          value={date}
          max={todayIso}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setDate(shiftDay(date, 1))}
          disabled={date >= todayIso}
        >
          Próximo dia →
        </button>
        {date === todayIso && <span className="muted">Hoje ainda está em andamento.</span>}
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="stat-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: "5.5rem" }} />
          ))}
        </div>
      ) : !hasData ? (
        <p className="panel muted">Sem dados do relógio para este dia.</p>
      ) : (
        <div className={isPlaceholderData ? "is-refreshing" : undefined}>
          <h2 className="section-title">O que o dia mostra</h2>
          <InsightsPanel insights={insights} />

          <h2 className="section-title">Números do dia</h2>
          <div className="stat-grid" role="group" aria-label="Números do dia">
            <StatTile
              label="Passos"
              value={day.steps != null ? int.format(day.steps) : "—"}
              detail={day.stepsGoal ? `meta ${int.format(day.stepsGoal)}` : undefined}
              delta={
                inProgress
                  ? null
                  : delta(
                      day.steps,
                      base((d) => d.steps),
                    )
              }
              deltaLabel={VS}
            />
            <StatTile
              label="FC de repouso"
              value={day.restingHr != null ? `${day.restingHr} bpm` : "—"}
              delta={delta(
                day.restingHr,
                base((d) => d.restingHr),
                false,
              )}
              deltaLabel={VS}
            />
            <StatTile
              label="Sono"
              value={day.sleep?.totalS != null ? formatTotalTime(day.sleep.totalS) : "—"}
              detail={
                day.sleep
                  ? `${day.sleep.score != null ? `nota ${day.sleep.score} · ` : ""}${time(day.sleep.startLocal)}–${time(day.sleep.endLocal)}`
                  : undefined
              }
              delta={delta(
                day.sleep?.totalS,
                base((d) => d.sleep?.totalS),
              )}
              deltaLabel={VS}
            />
            <StatTile
              label="HRV da noite"
              value={day.hrv?.lastNightAvg != null ? `${day.hrv.lastNightAvg} ms` : "—"}
              detail={
                day.hrv?.weeklyAvg != null ? `média semanal ${day.hrv.weeklyAvg} ms` : undefined
              }
              delta={delta(day.hrv?.lastNightAvg, day.hrv?.weeklyAvg ?? null)}
              deltaLabel={day.hrv?.weeklyAvg != null ? "vs média semanal" : undefined}
            />
            <StatTile
              label="Body Battery"
              value={
                day.bodyBatteryMax != null
                  ? `${day.bodyBatteryMin ?? "—"}–${day.bodyBatteryMax}`
                  : "—"
              }
              detail={
                day.bodyBatteryCharged != null
                  ? `recarregou ${day.bodyBatteryCharged} · gastou ${day.bodyBatteryDrained ?? "—"}`
                  : undefined
              }
              delta={delta(
                day.bodyBatteryMax,
                base((d) => d.bodyBatteryMax),
              )}
              deltaLabel={VS}
            />
            <StatTile
              label="Estresse médio"
              value={day.stressAvg != null ? String(day.stressAvg) : "—"}
              detail="escala 0–100"
              delta={delta(
                day.stressAvg,
                base((d) => d.stressAvg),
                false,
              )}
              deltaLabel={VS}
            />
            <StatTile
              label="Minutos de intensidade"
              value={
                day.intensityModerate != null || day.intensityVigorous != null
                  ? `${(day.intensityModerate ?? 0) + (day.intensityVigorous ?? 0)} min`
                  : "—"
              }
              detail={`${day.intensityModerate ?? 0} moderados · ${day.intensityVigorous ?? 0} vigorosos`}
            />
            <StatTile
              label="Calorias"
              value={day.caloriesTotal != null ? `${int.format(day.caloriesTotal)} kcal` : "—"}
              detail={
                day.caloriesActive != null ? `ativas ${int.format(day.caloriesActive)}` : undefined
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
