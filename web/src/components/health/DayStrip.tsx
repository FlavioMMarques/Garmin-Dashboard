import type { DayPoint } from "../../api/daily";
import { shiftDate } from "../../lib/health";
import { ProgressRing } from "./ProgressRing";

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const oneDecimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const asUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);
/** 12800 → "12,8 mil"; 640 → "640". */
const compact = (n: number) => (n >= 1000 ? `${oneDecimal.format(n / 1000)} mil` : int.format(n));

interface Props {
  /** Selected day (YYYY-MM-DD); the strip ends on it. */
  date: string;
  today: string;
  /** History that covers at least the strip's days. */
  days: DayPoint[] | undefined;
  onPick: (date: string) => void;
}

const DAYS = 7;

/** The week ending on the chosen day: a ring per day for the step goal, click to open it. */
export function DayStrip({ date, today, days, onPick }: Props) {
  const byDate = new Map(days?.map((d) => [d.date, d]));
  const dates = Array.from({ length: DAYS }, (_, i) => shiftDate(date, i - (DAYS - 1)));
  return (
    <div className="day-strip" role="group" aria-label="Últimos 7 dias">
      {dates.map((d) => {
        const p = byDate.get(d);
        const steps = p?.hasData ? p.steps : null;
        const goal = p?.stepGoal ?? null;
        const progress = steps != null && goal ? steps / goal : null;
        const isToday = d === today;
        const name = isToday ? "hoje" : `${weekday.format(asUtc(d)).replace(".", "")} ${Number(d.slice(8))}`;
        return (
          <button
            key={d}
            type="button"
            className={`day-chip${isToday ? " is-today" : ""}`}
            aria-current={d === date ? "date" : undefined}
            aria-label={`${fullDay.format(asUtc(d))}: ${steps == null ? "sem dados" : `${int.format(steps)} passos`}`}
            onClick={() => onPick(d)}
          >
            <span className="day-chip-name">{name}</span>
            <ProgressRing progress={progress} size={34} stroke={5} muted={isToday} />
            <span className="day-chip-value">
              {isToday ? "em andamento" : steps == null ? "—" : compact(steps)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
