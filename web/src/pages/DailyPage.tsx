import { useState } from "react";
import { useDaily, useDailyRange, type DailySummary } from "../api/daily";
import { DayStrip } from "../components/health/DayStrip";
import { ProgressRing } from "../components/health/ProgressRing";
import { RangeBar, StressGauge } from "../components/health/RangeBar";
import { DayInsights } from "../components/DayInsights";
import { ErrorBanner } from "../components/ErrorBanner";
import { StatTile } from "../components/StatTile";
import { formatDistance } from "../lib/format";
import { intensityMinutes, localDateKey, shiftDate, stressLabel } from "../lib/health";

const DASH = "—";
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const n = (v: number | null) => (v == null ? DASH : int.format(v));
const withUnit = (v: number | null, unit: string) =>
  v == null ? DASH : `${int.format(v)} ${unit}`;
/** Joins the parts that have data: "meta 9.180 · 4,66 km". */
const detail = (...parts: (string | false | null)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;
const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/** Same window DayInsights compares against, so the strip reuses its cached history. */
const HISTORY_DAYS = 30;

export function DailyPage() {
  const today = localDateKey(new Date());
  const [date, setDate] = useState(today);
  const { data, error, isPending, isPlaceholderData, refetch } = useDaily(date);
  const history = useDailyRange(shiftDate(date, -HISTORY_DAYS), date);
  const title = longDate.format(new Date(`${date}T12:00:00Z`));

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Saúde diária</h1>
          <p className="page-subtitle">{title.charAt(0).toUpperCase() + title.slice(1)}</p>
        </div>
      </div>

      <DayStrip date={date} today={today} days={history.data} onPick={setDate} />

      <div className="toolbar">
        <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))}>
          ← Dia anterior
        </button>
        <label className="date-field">
          Data
          <input
            type="date"
            value={date}
            max={today}
            // `max` does not stop a typed future date; ignore it (and a cleared field).
            onChange={(e) => {
              const v = e.target.value;
              if (v && v <= today) setDate(v);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setDate((d) => shiftDate(d, 1))}
          disabled={date >= today}
        >
          Próximo dia →
        </button>
        {date === today && (
          <span className="muted">Dia em andamento — os números ainda sobem.</span>
        )}
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="stat-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: "5.5rem" }} />
          ))}
        </div>
      ) : (
        <>
          {!data.hasData && (
            <p role="status" className="muted">
              Sem dados do relógio neste dia.
            </p>
          )}
          <DayTiles day={data} refreshing={isPlaceholderData} />
          <DayInsights date={date} today={today} />
        </>
      )}
    </section>
  );
}

function DayTiles({ day: d, refreshing }: { day: DailySummary; refreshing: boolean }) {
  const intensity = intensityMinutes(d.intensityModerate, d.intensityVigorous);
  const stress = stressLabel(d.stressQualifier);
  const stepShare = d.steps != null && d.stepGoal ? d.steps / d.stepGoal : null;
  const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
  return (
    <div
      className={`day-tiles${refreshing ? " is-refreshing" : ""}`}
      role="group"
      aria-label={`Resumo de ${d.date}`}
      aria-busy={refreshing}
    >
      <div className="feature-grid">
        <div className="feature-steps">
          <ProgressRing
            progress={stepShare}
            size={132}
            stroke={13}
            center={stepShare == null ? undefined : pct.format(stepShare)}
            label={stepShare == null ? undefined : `${pct.format(stepShare)} da meta de passos`}
          />
          <StatTile
            label="Passos"
            value={n(d.steps)}
            detail={detail(
              d.stepGoal != null && `meta ${n(d.stepGoal)}`,
              d.distanceMeters != null && formatDistance(d.distanceMeters),
            )}
          />
        </div>
        <StatTile
          label="Body Battery"
          value={
            d.bodyBatteryMin == null || d.bodyBatteryMax == null
              ? DASH
              : `${d.bodyBatteryMin}–${d.bodyBatteryMax}`
          }
          detail={detail(
            d.bodyBatteryCharged != null && `+${d.bodyBatteryCharged} carregou`,
            d.bodyBatteryDrained != null && `−${d.bodyBatteryDrained} gastou`,
            d.bodyBatteryAtWake != null && `ao acordar ${d.bodyBatteryAtWake}`,
          )}
        >
          {d.bodyBatteryMin != null && d.bodyBatteryMax != null && (
            <RangeBar
              min={d.bodyBatteryMin}
              max={d.bodyBatteryMax}
              label={`Variou de ${d.bodyBatteryMin} a ${d.bodyBatteryMax} numa escala de 0 a 100`}
            />
          )}
        </StatTile>
        <StatTile
          label="Estresse médio"
          value={n(d.stressAvg)}
          detail={detail(stress, d.stressMax != null && `máx ${n(d.stressMax)}`)}
        >
          {d.stressAvg != null && <StressGauge value={d.stressAvg} />}
        </StatTile>
      </div>
      <div className="stat-grid">
        <StatTile
          label="Calorias"
          value={withUnit(d.caloriesTotal, "kcal")}
          detail={detail(d.caloriesActive != null && `${n(d.caloriesActive)} kcal ativas`)}
        />
        <StatTile
          label="FC em repouso"
          value={withUnit(d.restingHr, "bpm")}
          detail={detail(
            d.restingHr7dAvg != null && `média 7 dias ${n(d.restingHr7dAvg)}`,
            d.minHr != null && d.maxHr != null && `mín ${n(d.minHr)} · máx ${n(d.maxHr)}`,
          )}
        />
        <StatTile
          label="Minutos de intensidade"
          value={withUnit(intensity, "min")}
          detail={detail(
            intensity != null &&
              `${n(d.intensityModerate ?? 0)} moderados · ${n(d.intensityVigorous ?? 0)} vigorosos (×2)`,
            d.intensityGoal != null && `meta semanal ${n(d.intensityGoal)}`,
          )}
        />
        <StatTile
          label="Andares subidos"
          value={n(d.floorsAscended == null ? null : Math.floor(d.floorsAscended))}
        />
        <StatTile label="SpO₂ média" value={d.spo2Avg == null ? DASH : `${n(d.spo2Avg)}%`} />
      </div>
    </div>
  );
}
