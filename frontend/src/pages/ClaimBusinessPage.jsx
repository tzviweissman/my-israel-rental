/**
 * /claim/:token — the page we built for a business, handed to the person
 * who runs it (backend routes/marketplace/businesses.py, "handing a page
 * over").
 *
 * Most of the businesses worth approaching will never fill in a sign-up
 * form: of the taxi companies surveyed on 18 Oct 2026 several had no
 * website at all. So the page is built first and this is where it changes
 * hands. One tap, one sign-in, done.
 *
 * Two things this screen must not do, both of which decide whether it is
 * safe to send to a stranger:
 *
 *   * It shows what is being claimed BEFORE asking anyone to sign in. A
 *     link that demands a Google account before saying what it is reads
 *     exactly like a phishing page, and the people receiving these have
 *     every reason to be careful.
 *   * It never claims anything on load. The transfer happens when they
 *     press the button, so arriving at the link, or a mail client
 *     prefetching it, cannot spend it.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Store } from 'lucide-react';
import { API } from '../lib/apiBase';

export default function ClaimBusinessPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // null = still loading, false = the link is no longer good.
  const [biz, setBiz] = useState(null);
  const [busy, setBusy] = useState(false);
  const signedIn = !!sessionStorage.getItem('token');

  useEffect(() => {
    axios.get(`${API}/marketplace/claim/${encodeURIComponent(token)}`)
      .then(({ data }) => setBiz(data))
      .catch(() => setBiz(false));
  }, [token]);

  const claim = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/claim/${encodeURIComponent(token)}`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      toast.success(t('claim.done', 'It is yours. You can edit the page any time.'));
      navigate(`/business/${data.slug}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('claim.failed', 'Could not do that. Try the link again.'), { duration: 8000 });
    } finally { setBusy(false); }
  };

  if (biz === null) {
    return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  }
  if (biz === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
          {t('claim.badLink', 'This link no longer works')}
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>
          {t('claim.badLinkBody', 'It may have been used already, or it may have expired. Ask us for a new one.')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center" data-testid="claim-page">
      {biz.logo_url
        ? <img src={biz.logo_url} alt="" className="w-20 h-20 rounded-2xl object-contain mx-auto mb-4" />
        : (
          <span className="w-20 h-20 rounded-2xl mx-auto mb-4 grid place-content-center"
                style={{ background: 'var(--bg)', border: '1px solid var(--brand-border)' }}>
            <Store size={28} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
          </span>
        )}
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
        {t('claim.eyebrow', 'We made this for you')}
      </p>
      <h1 className="text-2xl font-bold mt-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }} dir="auto">
        {biz.name}
      </h1>
      <p className="text-sm mt-3" style={{ color: 'var(--ink)' }}>
        {biz.listings > 0
          ? t('claim.bodyWithListings', 'A page on MyIsraelRental with {{n}} of your services on it. Take it over and it is yours to change, free, with no commission.', { n: biz.listings })
          : t('claim.body', 'A page on MyIsraelRental, ready for you. Take it over and it is yours to change, free, with no commission.')}
      </p>

      {signedIn ? (
        <button type="button" onClick={claim} disabled={busy}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="claim-take">
          {busy && <Loader2 size={15} className="animate-spin" />}
          {t('claim.take', 'This is my business')}
        </button>
      ) : (
        <>
          {/* Signing in is the LAST step, and the page has already said
              what it is. `redirect` brings them straight back here. */}
          <a href={`/auth/login?redirect=${encodeURIComponent(`/claim/${token}`)}`}
            className="mt-6 w-full inline-flex items-center justify-center min-h-[48px] rounded-full text-sm font-semibold"
            style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="claim-signin">
            {t('claim.signIn', 'Sign in to take it')}
          </a>
          <p className="text-xs mt-3" style={{ color: 'var(--brand-muted)' }}>
            {t('claim.signInWhy', 'Signing in is how the page becomes yours. Nothing happens until you press the button.')}
          </p>
        </>
      )}
    </div>
  );
}
