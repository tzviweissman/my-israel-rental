/**
 * Page builder v3: the owner chooses their page from versions (Tzvi,
 * 6 Oct 2026: "owners pick from three versions, from the start").
 *
 * Shown in the page editor only once an admin has switched the business to
 * the new page builder: the versions endpoint answers 409 until then, and
 * this renders nothing. Each version is the real page component, at phone
 * width, with that version's design brief (the same injection the editor's
 * own preview uses). Previews are still, so each says in words what its bold
 * moment does as you scroll.
 *
 * Publishing does not put a page live: the visual check renders it first
 * (backend routes/marketplace/page_versions.py, the page-check service), and
 * only a pass replaces the live page. This polls while a check runs.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import BusinessPage from '../../pages/BusinessPage';
import PreviewFrame from './PreviewFrame';
import { plainReasons } from '../../utils/pageCheckReasons';

const POLL_MS = 8000;

// What each bold moment does, in the owner's terms.
const MOMENT = {
  'pin-hero-hold': ['momentHold', 'Your photo holds at the top and dims as people scroll'],
  'pin-hero-pushin': ['momentPushin', 'The camera moves slowly in on your photo as people scroll'],
  'scrub-film': ['momentFilm', 'Your film plays as people scroll'],
  'rail-gallery': ['momentGallery', 'Your photos slide sideways in one row'],
  'rail-occasions': ['momentOccasions', 'What you are for slides past in large type'],
  'rail-steps': ['momentStepsRail', 'Your steps slide past one by one'],
  'stack-steps': ['momentStepsStack', 'Your steps stack up like cards'],
  hero: ['momentHero', 'A calm page: your name and photo, no big movement'],
};

export default function PageVersions({ business, page, API, token, onLive }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const base = `${API}/marketplace/businesses/${business.id}/page-versions`;
  const [versions, setVersions] = useState(null);   // null: loading or not available
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(base, auth);
      setVersions(data.versions);
      return data.versions;
    } catch {
      // Not switched on (409), not theirs (403), or an API without versions:
      // nothing to choose from, so nothing is shown.
      setAvailable(false);
      return null;
    }
  }, [base, auth]);

  useEffect(() => { load(); }, [load]);

  // While a check runs, look again every few seconds; say so when it ends.
  const checking = (versions || []).find((v) => v.status === 'checking');
  useEffect(() => {
    if (!checking) return undefined;
    const id = setInterval(async () => {
      const next = await load();
      const now = (next || []).find((v) => v.id === checking.id);
      if (!now || now.status === 'checking') return;
      if (now.status === 'live') {
        toast.success(t('pageVersions.wentLive', 'Your new page is live'));
        if (onLive) onLive();
      } else {
        toast.error(t('pageVersions.didNotPass', 'That version did not pass the check. Your page has not changed.'));
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [checking, load, onLive, t]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pageVersions.failed', 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  const generate = () => act(() => axios.post(base, null, auth));
  const publish = (v) => act(async () => {
    const { data } = await axios.post(`${base}/${v.id}/publish`, null, auth);
    if (!data.check_requested) toast(t('pageVersions.checkLater', 'Saved. The check will run shortly.'));
  });

  if (!available) return null;
  if (versions === null) {
    return <div className="py-4 flex justify-center"><Loader2 className="animate-spin" size={18} /></div>;
  }

  const candidates = versions.filter((v) => ['candidate', 'checking', 'failed'].includes(v.status)).slice(0, 3);
  const live = versions.find((v) => v.status === 'live');
  const earlier = versions.filter((v) => v.status === 'archived');
  const dir = i18n.dir ? i18n.dir() : 'ltr';
  const moment = (v) => {
    const [key, text] = MOMENT[v.showstopper] || MOMENT.hero;
    return t(`pageVersions.${key}`, text);
  };

  return (
    <section data-testid="page-versions">
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
        {t('pageVersions.title', 'Choose your page')}
      </h3>
      <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--brand-muted)' }}>
        {t('pageVersions.hint', 'Different versions of your page, made from what you have told us. Pick one; we check it on every screen size before it goes live.')}
      </p>

      {live && (
        <p className="text-xs mb-3 font-semibold" style={{ color: 'var(--ink)' }} data-testid="page-versions-live">
          {t('pageVersions.liveNow', 'Live now')}: {moment(live)}
        </p>
      )}

      {candidates.length > 0 && (
        // One a row: the editor's side column is narrow, and a phone page
        // shrunk to a third of it is too small to judge.
        <div className="grid grid-cols-1 gap-3">
          {candidates.map((v) => (
            <div key={v.id} className="rounded-xl border p-2 flex flex-col gap-2" style={{ borderColor: 'var(--brand-border)' }}
              data-testid={`page-version-${v.status}`}>
              <div className="h-[440px] rounded-lg overflow-hidden" style={{ background: 'var(--bg)' }}>
                <PreviewFrame width={390} dir={dir} lang={i18n.language} className="w-full h-full"
                  title={t('pageVersions.previewTitle', 'Preview of one version of your page')}>
                  <div onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <BusinessPage business={{ ...page, page_v3: true, design_brief: v.brief }} preview />
                  </div>
                </PreviewFrame>
              </div>
              <p className="text-xs" style={{ color: 'var(--ink)' }}>{moment(v)}</p>
              {v.status === 'checking' && (
                <p className="text-xs inline-flex items-center gap-1.5" style={{ color: 'var(--brand-muted)' }}>
                  <Loader2 className="animate-spin" size={12} />
                  {t('pageVersions.checking', 'Checking it on every screen size. Usually a few minutes.')}
                </p>
              )}
              {v.status === 'failed' && (
                <div className="text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="page-version-failures">
                  <p>{t('pageVersions.failedCheck', 'It did not pass the check, so your page did not change:')}</p>
                  <ul className="list-disc ps-4">
                    {plainReasons(v.failures, t).slice(0, 3).map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              )}
              {v.status !== 'checking' && (
                <button type="button" disabled={busy || Boolean(checking)} onClick={() => publish(v)}
                  className="mt-auto rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }}
                  data-testid="page-version-publish">
                  {v.status === 'failed' ? t('pageVersions.tryAgain', 'Check it again') : t('pageVersions.publish', 'Use this one')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={generate} disabled={busy || Boolean(checking)}
        className="mt-3 rounded-full px-3 py-2 text-xs font-semibold border disabled:opacity-50"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
        data-testid="page-versions-generate">
        {busy && <Loader2 className="inline animate-spin me-1" size={12} />}
        {candidates.length ? t('pageVersions.makeNew', 'Make new versions') : t('pageVersions.make', 'Make versions to choose from')}
      </button>

      {earlier.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{t('pageVersions.earlier', 'Earlier pages')}</h4>
          <ul className="mt-1 space-y-1">
            {earlier.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                <span>{moment(v)} · {new Date(v.published_at || v.created_at).toLocaleDateString(i18n.language)}</span>
                <button type="button" disabled={busy || Boolean(checking)} onClick={() => publish(v)}
                  className="font-semibold underline disabled:opacity-50" style={{ color: 'var(--ink)' }}
                  data-testid="page-version-restore">
                  {t('pageVersions.restore', 'Restore')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
