/**
 * Stop someone before they send money to a stranger.
 *
 * WHY AN INTERSTITIAL AND NOT A BANNER. The site touches no money, has no
 * escrow, and will never say "buyer protection" - that is settled and not
 * changing. What it can do is interrupt at the payment moment, and that
 * is the only intervention in the research with a measured effect: the
 * BBB found that where a bank or card company intervened at that moment,
 * 40% of targets did not lose money.
 *
 * A banner does not interrupt. It renders next to eleven other pieces of
 * chrome and is read by nobody who is mid-conversation and already
 * inclined to trust the person they are talking to. This takes the
 * screen, states the one rule, and requires a deliberate dismissal.
 *
 * WHO SEES IT. Only the RECIPIENT - the person being asked to pay. The
 * sender is never told they triggered it, never blocked and never
 * accused, because this cannot distinguish a scammer from a genuinely
 * travelling buyer, and the honest advice to both is identical: do not
 * send money before you have the item.
 *
 * ONCE PER THREAD. It is shown for the first flagged message in a
 * conversation and then remembered. Firing on every subsequent message
 * would train the reflex that dismisses it, and then it is not there for
 * the message that matters.
 *
 * NO ACCUSATION IN THE COPY. It does not say the other person is a
 * scammer. It says what the site cannot do and what the reader should
 * not do, which is true regardless of who is on the other end, and which
 * cannot defame a legitimate buyer who happens to be abroad.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, X } from 'lucide-react';

const seenKey = (threadKey) => `apw-seen:${threadKey}`;

/** Has this thread already shown the warning? */
function alreadySeen(threadKey) {
  try {
    return !!window.localStorage.getItem(seenKey(threadKey));
  } catch {
    // Private mode, or storage disabled. Showing it again is the safe
    // failure: an extra dialog costs a click, a missed one costs money.
    return false;
  }
}

function remember(threadKey) {
  try {
    window.localStorage.setItem(seenKey(threadKey), '1');
  } catch { /* nothing to do; see above */ }
}

/**
 * @param {boolean} triggered  a flagged message from the OTHER party is present
 * @param {string}  threadKey  stable id for this conversation
 */
export default function AdvancePaymentWarning({ triggered, threadKey }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (triggered && threadKey && !alreadySeen(threadKey)) setOpen(true);
  }, [triggered, threadKey]);

  if (!open) return null;

  const dismiss = () => {
    remember(threadKey);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.55)' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="apw-title"
      data-testid="advance-payment-warning"
    >
      <div
        className="w-full sm:max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--brand-border)' }}
      >
        <div className="p-6">
          <span
            className="w-11 h-11 rounded-xl inline-flex items-center justify-center mb-4"
            style={{ background: '#FDECEC', color: '#8A1F1F' }}
          >
            <ShieldAlert size={22} aria-hidden="true" />
          </span>
          <h2
            id="apw-title"
            className="text-xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('advancePayment.title', 'Do not send money before you have the item')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--brand-muted)' }}>
            {t('advancePayment.body',
              'This message asks about paying, or sending a courier, before you collect. '
              + 'That is the most common way people are cheated on second-hand boards here.')}
          </p>
          <ul className="text-sm leading-relaxed mb-4 ps-4" style={{ color: 'var(--brand-muted)', listStyle: 'disc' }}>
            <li>{t('advancePayment.ruleCollect', 'Pay when you collect, in person.')}</li>
            <li>{t('advancePayment.ruleScreenshot', 'A transfer screenshot is not a payment. They are easily faked.')}</li>
            <li>{t('advancePayment.ruleCourier', 'A courier or shipping fee asked for up front is a scam pattern.')}</li>
          </ul>
          {/* Says what the site cannot do. Never implies it can. */}
          <p className="text-xs leading-snug" style={{ color: 'var(--brand-muted)' }}>
            {t('advancePayment.noProtection',
              'MyIsraelRental never handles payment and cannot recover money you send.')}
          </p>
        </div>
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: '1px solid var(--brand-border)', background: 'var(--bg)' }}
        >
          <button
            type="button"
            onClick={dismiss}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            data-testid="advance-payment-dismiss"
          >
            <X size={15} aria-hidden="true" />
            {t('advancePayment.understood', 'I understand')}
          </button>
        </div>
      </div>
    </div>
  );
}
