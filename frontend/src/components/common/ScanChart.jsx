/**
 * Scans per day, as a small bar chart in the share popovers.
 *
 * One series, so: no legend (the heading names it), bars in the single
 * brand hue on white, text in ink/muted tokens rather than the bar colour,
 * a recessive baseline instead of a grid, and only the peak day carries a
 * printed number — every other value is on hover (native tooltip per bar).
 *
 * dir=ltr always: time reads oldest→newest left-to-right even on the
 * Hebrew dashboard, the same way the URL under the QR stays LTR.
 *
 * Zero-filled 30-day data arrives from the server (oldest first); the
 * chart shows the last 14 — two weeks answers "is the sign working" and
 * fits a 320px popover without the bars thinning into a barcode.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import formatDate from '../../utils/formatDate';

// Axis dates are numeric (18/8): the axis is LTR because time is, and
// Hebrew month words inside an LTR run get visually scrambled by bidi
// ("2026 באוג׳ 18"). Digits are direction-neutral. The tooltip, which is
// plain HTML with its own direction, keeps the worded format.
const axisDate = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

const BAR_COLOR = 'var(--brand-primary)';
const DAYS_SHOWN = 14;

// `title` exists because this chart is no longer only about QR scans —
// the leads panel plots contact taps with the same shape. Defaulting to
// the scans wording keeps every existing caller unchanged.
export default function ScanChart({ daily, testidPrefix = 'qr', title }) {
  const { t } = useTranslation();
  const heading = title || t('qr.chartTitle', 'Scans — last 14 days');
  if (!Array.isArray(daily) || daily.length === 0) return null;

  const days = daily.slice(-DAYS_SHOWN);
  const max = Math.max(...days.map((d) => d.count));
  // All-zero fortnight: the count line above the chart already says
  // "not scanned yet" (or an older total); an empty axis adds nothing.
  if (max === 0) return null;

  const W = 280;
  const H = 64;
  const GAP = 2;
  const barW = (W - GAP * (days.length - 1)) / days.length;
  const peakIdx = days.findIndex((d) => d.count === max);

  return (
    <div dir="ltr" data-testid={`${testidPrefix}-chart`}>
      <p className="mb-1 text-[11px] font-semibold text-start" style={{ color: 'var(--brand-muted)' }}>
        {heading}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H + 14}`}
        className="w-full"
        role="img"
        aria-label={heading}
      >
        {days.map((d, i) => {
          const h = d.count === 0 ? 0 : Math.max(3, (d.count / max) * H);
          const x = i * (barW + GAP);
          return (
            <g key={d.date}>
              {/* Full-height invisible hit target so the tooltip works on
                  short and zero bars, not only tall ones. */}
              <rect x={x} y={0} width={barW} height={H} fill="transparent">
                <title>{`${formatDate(d.date)}: ${d.count}`}</title>
              </rect>
              {h > 0 && (
                <rect
                  x={x}
                  y={H - h}
                  width={barW}
                  height={h}
                  rx={2}
                  fill={BAR_COLOR}
                  pointerEvents="none"
                />
              )}
              {i === peakIdx && (
                <text
                  x={x + barW / 2}
                  y={Math.max(9, H - h - 4)}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="var(--ink)"
                >
                  {max}
                </text>
              )}
            </g>
          );
        })}
        {/* Recessive baseline + the two dates that anchor the axis. */}
        <line x1="0" y1={H + 0.5} x2={W} y2={H + 0.5} stroke="var(--brand-border)" strokeWidth="1" />
        <text x="0" y={H + 11} fontSize="8.5" fill="var(--brand-muted)">
          {axisDate(days[0].date)}
        </text>
        <text x={W} y={H + 11} textAnchor="end" fontSize="8.5" fill="var(--brand-muted)">
          {axisDate(days[days.length - 1].date)}
        </text>
      </svg>
    </div>
  );
}
