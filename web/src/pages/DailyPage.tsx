import { useState } from "react";
import { useDaily, type DailySummary } from "../api/daily";
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

export function DailyPage() {
  const today = localDateKey(new Date());
  const [date, setDate] = useState(today);
  const { data, error, isPending, isPlaceholderData, refetch } = useDaily(date);

  return (
    <section>
      <h1>Saúde diária</h1>

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
            onChange={(e) => e.target.value && setDate(e.target.value)}
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
        </>
      )}
    </section>
  );
}

function DayTiles({ day: d, refreshing }: { day: DailySummary; refreshing: boolean }) {
  const intensity = intensityMinutes(d.intensityModerate, d.intensityVigorous);
  const stress = stressLabel(d.stressQualifier);
  return (
    <div
      className={`stat-grid${refreshing ? " is-refreshing" : ""}`}
      role="group"
      aria-label={`Resumo de ${d.date}`}
      aria-busy={refreshing}
    >
      <StatTile
        label="Passos"
        value={n(d.steps)}
        detail={detail(
          d.stepGoal != null && `meta ${n(d.stepGoal)}`,
          d.distanceMeters != null && formatDistance(d.distanceMeters),
        )}
      />
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
        label="Estresse médio"
        value={n(d.stressAvg)}
        detail={detail(stress, d.stressMax != null && `máx ${n(d.stressMax)}`)}
      />
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
      <StatTile label="Andares subidos" value={n(d.floorsAscended == null ? null : Math.floor(d.floorsAscended))} />
      <StatTile label="SpO₂ média" value={d.spo2Avg == null ? DASH : `${n(d.spo2Avg)}%`} />
    </div>
  );
}
