/**
 * T1 — the setup checklist. The backbone of onboarding.
 *
 * From `docs/onboarding-tutorial-spec.md`:
 *
 *   A tour is not the goal. A complete page and a first message are.
 *
 * So every row is an OUTCOME with a link to the field that satisfies it,
 * never an explanation. The state comes from `/onboarding/state`, which
 * computes each row from records — never from "the user saw this screen".
 *
 * ENDOWED PROGRESS
 * ----------------
 * The first row of each list is already ticked, because it is genuinely
 * already done: naming the business is required to create one, and a
 * listing cannot exist without a title, an area and a price. Nobody opens
 * this at zero, and nothing is invented to achieve that — see the long note
 * in `backend/routes/onboarding.py` about where the spec's version of this
 * did not survive contact with the code.
 *
 * NO INVENTED STATISTICS
 * ----------------------
 * Not "listings with photos get 3x more views" — nobody here has measured
 * that. The honest line does the same work: *"Visitors decide in about a
 * second — give them something to look at."*
 *
 * NEVER A PERCENTAGE WITHOUT THE NEXT ACTION BESIDE IT. The heading carries
 * the count and the first unfinished row is directly beneath it, styled as
 * the one thing to do next.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { useOnboarding, localeKeyFor } from './OnboardingProvider';
import ShowMeAroundOffer from './ShowMeAroundOffer';

// Green here is FUNCTIONAL — "this is done" — which is exactly what the
// palette reserves it for. It is never used as decoration on this panel.
const DONE_GREEN = '#1F8A50';

export default function SetupChecklist() {
  const { t } = useTranslation();
  const ctx = useOnboarding();
  if (!ctx?.ready) return null;

  const lists = ctx.state?.checklists || [];
  if (lists.length === 0) return null;

  const allDone = lists.every((l) => l.done === l.total);

  // Complete: gone. It used to stay as a one-line "Your setup is
  // complete" until dismissed. The owner of a finished business asked
  // for it to leave on its own - a panel about setup has nothing to say
  // once setup is done, and the space is the dashboard's.
  if (allDone) return null;

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5 mb-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--brand-border)' }}
      data-testid="setup-checklist"
      data-tour="setup-checklist"
    >
      {lists.map((list, listIndex) => {
        const pct = list.total ? Math.round((list.done / list.total) * 100) : 0;
        // The next thing to do. Named separately because the spec's rule is
        // that a percentage never appears without it.
        const next = list.items.find((i) => !i.done);
        return (
          <section
            key={list.role}
            className={listIndex > 0 ? 'mt-6 pt-5 border-t' : ''}
            style={listIndex > 0 ? { borderColor: 'var(--brand-border)' } : undefined}
            data-testid={`setup-checklist-${list.role}`}
          >
            <h2
              className="text-base font-bold"
              // Never the literal face: Playfair has no Hebrew glyphs and an
              // inline literal beats the RTL variable swap.
              style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
            >
              {list.role === 'business'
                ? t('setup.businessTitle', 'Finish setting up your business')
                : t('setup.propertyTitle', 'Finish setting up your listing')}
            </h2>

            <div className="flex items-center gap-3 mt-2 mb-3">
              <div
                className="h-1.5 rounded-full flex-1 overflow-hidden"
                style={{ background: 'var(--brand-border)' }}
                role="progressbar"
                aria-valuenow={list.done}
                aria-valuemin={0}
                aria-valuemax={list.total}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: 'var(--brand-primary)' }}
                />
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--brand-muted)' }}>
                {t('setup.count', '{{done}} of {{total}}', { done: list.done, total: list.total })}
              </span>
            </div>

            <ul className="space-y-1.5">
              {list.items.map((item) => {
                const lk = localeKeyFor(item.id);
                const label = t(`setup.item.${lk}`, item.id);
                if (item.done) {
                  return (
                    <li key={item.id} data-testid={`setup-item-${item.id}`} data-done="true">
                      <span
                        className="inline-flex items-center gap-2 text-sm"
                        style={{ color: 'var(--brand-muted)' }}
                      >
                        <CheckCircle2 size={15} style={{ color: DONE_GREEN }} aria-hidden="true" />
                        <s>{label}</s>
                      </span>
                    </li>
                  );
                }
                const isNext = next && next.id === item.id;
                return (
                  <li key={item.id} data-testid={`setup-item-${item.id}`} data-done="false">
                    <Link
                      to={item.href}
                      className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                      style={{ color: 'var(--brand-primary)' }}
                      data-testid={`setup-action-${item.id}`}
                    >
                      <Circle size={15} aria-hidden="true" />
                      {label}
                      <ChevronRight size={14} aria-hidden="true" className="rtl:rotate-180" />
                    </Link>
                    {/* The reason, only on the item being asked for next —
                        on every row it would be a wall of text. Honest
                        motivation, never a statistic we have not measured. */}
                    {isNext && t(`setup.why.${lk}`, '') ? (
                      <p className="text-xs mt-0.5 ms-6" style={{ color: 'var(--brand-muted)' }}>
                        {t(`setup.why.${lk}`, '')}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* T7 — someone staring at a checklist is already in a learning frame
          of mind. Beneath it, never instead of it. */}
      <ShowMeAroundOffer moment="checklist" />
    </div>
  );
}
