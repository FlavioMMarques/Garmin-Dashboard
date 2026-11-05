/** 8px dot with a 2px surface ring, inside a transparent 24px hit target. */
export function ringedDot(color: string, surface: string, opacity = 0.5) {
  return function RingedDot(props: { cx?: number; cy?: number }) {
    return (
      <g>
        <circle cx={props.cx} cy={props.cy} r={12} fill="transparent" />
        <circle
          cx={props.cx}
          cy={props.cy}
          r={4}
          fill={color}
          fillOpacity={opacity}
          stroke={surface}
          strokeWidth={2}
        />
      </g>
    );
  };
}
