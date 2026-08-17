/**
 * "Needs your attention" — one line above the tabs (spec D5).
 *
 * The dashboard opened on a list of properties, which answers "what do I
 * have" when the question someone arrives with is "what changed". This
 * answers that in a sentence, and every clause is a link to the tab that
 * fixes it.
 *
 * Renders NOTHING when there is nothing. No "All caught up!", no empty
 * card, no reserved space — a cheerful banner saying zero is still a thing
 * to read past every single visit, and the absence of the strip already
 * says the same thing faster.
 *
 * The counts come from the same /dashboard/summary call the tab badges
 * use, so the strip and the badges cannot disagree.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

export default function AttentionStrip({ summary = {}, unreadMessages = 0, onGoToTab }) {
  const { t } = useTranslation();

  // Order is deliberate: someone waiting on a reply outranks a number that
  // is merely interesting. Messages and pending bookings are other people
  // waiting; expiring requests are a deadline; responses are good news.
  const items = [
    unreadMessages > 0 && {
      key: 'messages',
      tab: 'messages',
      text: t('dashboard.attentionMessages', '{{n}} unread messages', { n: unreadMessages }),
    },
    summary.bookings_awaiting_reply > 0 && {
      key: 'bookings',
      tab: 'bookings',
      text: t('dashboard.attentionBookings', '{{n}} bookings awaiting your reply', { n: summary.bookings_awaiting_reply }),
    },
    summary.requests_expiring_soon > 0 && {
      key: 'expiring',
      tab: 'my-requests',
      text: t('dashboard.attentionExpiring', '{{n}} requests expiring this week', { n: summary.requests_expiring_soon }),
    },
    summary.requests_with_responses > 0 && {
      key: 'responses',
      tab: 'my-requests',
      text: t('dashboard.attentionResponses', '{{n}} requests have replies', { n: summary.requests_with_responses }),
    },
    summary.work_offers_open > 0 && {
      key: 'offers',
      tab: 'job-requests',
      text: t('dashboard.attentionOffers', '{{n}} work offers you have not answered', { n: summary.work_offers_open }),
    },
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: 'var(--brand-border)', background: '#fff' }}
      data-testid="attention-strip"
    >
      <span
        className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}
        aria-hidden="true"
      >
        <Bell size={14} />
      </span>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
        {items.map((item, i) => (
          <React.Fragment key={item.key}>
            {i > 0 && <span aria-hidden="true" style={{ color: 'var(--brand-muted)' }}> · </span>}
            <button
              type="button"
              onClick={() => onGoToTab(item.tab)}
              className="font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
              data-testid={`attention-${item.key}`}
            >
              {item.text}
            </button>
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}
