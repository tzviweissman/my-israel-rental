/**
 * "Get found on Google and AI" (backend routes/seo.py, GET /seo/my-checklist).
 *
 * For owners with the page upgrade only (Tzvi, 18 Oct 2026: "only for
 * upgraded business or rental pages"); renders nothing for anyone else.
 * Upgraded pages are given to search engines and AI assistants as readable
 * pages with structured data; this lists what makes those pages worth
 * finding, ticked from what the page already has. The last items happen
 * outside the site, so they are reminders with a button, never ticked.
 *
 * Folded by default: it is a list to come back to, not something to read
 * every visit, and the dashboard is not to be crowded.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ChevronDown, Circle, Copy, ExternalLink, Search } from 'lucide-react';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';

export default function GetFoundCard({ API, token, kind }) {
  const { t } = useTranslation();
  const [pages, setPages] = useState([]);
  const [open, setOpen] = useState(false);
  // One page at a time: an owner with eleven businesses got one count of 77.
  const [pick, setPick] = useState(0);

  useEffect(() => {
    let live = true;
    axios.get(`${API}/seo/my-checklist`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (live && data.upgraded) setPages((data.pages || []).filter((p) => p.kind === kind)); })
      .catch(() => {});
    return () => { live = false; };
  }, [API, token, kind]);

  if (!pages.length) return null;

  const page = pages[Math.min(pick, pages.length - 1)];
  const checkable = page.items.filter((i) => !i.reminder);
  const done = checkable.filter((i) => i.done).length;

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('getFound.copied', 'Link copied'));
    } catch {
      toast.error(url);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: BORDER }} data-testid="get-found-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-start min-h-[44px]"
      >
        <span>
          <span className="inline-flex items-center gap-2 text-lg font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            <Search size={18} style={{ color: 'var(--gold)' }} aria-hidden="true" />
            {t('getFound.title', 'Get found on Google and AI')}
          </span>
          <span className="block mt-1 text-sm" style={{ color: MUTED }}>
            {/* bdi: in Hebrew the count otherwise joins an English name's run. */}
            {pages.length > 1 && <><bdi>{page.name}</bdi>{': '}</>}{t('getFound.progress', '{{done}} of {{total}} done', { done, total: checkable.length })}
          </span>
        </span>
        <ChevronDown size={20} aria-hidden="true" style={{ color: MUTED, transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-sm" style={{ color: MUTED }}>
            {t('getFound.intro', 'Your page is given to Google, Bing, ChatGPT, Claude and Perplexity in a form they can read, in English and Hebrew. These are the things they look at when deciding who to show.')}
          </p>
          {pages.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={t('getFound.whichPage', 'Which page')}>
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={p === page}
                  onClick={() => setPick(i)}
                  className="min-h-[36px] px-3 rounded-full border text-[13px] font-semibold"
                  style={p === page
                    ? { background: 'var(--ink)', color: '#FFFFFF', borderColor: 'var(--ink)' }
                    : { background: '#FFFFFF', color: 'var(--ink)', borderColor: BORDER }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {(
            <div key={page.id} className="mt-4">
              <ul className="mt-2 grid gap-2">
                {page.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--ink)' }} data-testid={`get-found-${item.key}`}>
                    {item.reminder ? (
                      <Circle size={18} className="mt-0.5 shrink-0" style={{ color: MUTED }} aria-hidden="true" />
                    ) : item.done ? (
                      <Check size={18} className="mt-0.5 shrink-0" style={{ color: '#2E7D4F' }} aria-label={t('getFound.done', 'Done')} />
                    ) : (
                      <Circle size={18} className="mt-0.5 shrink-0" style={{ color: MUTED }} aria-label={t('getFound.toDo', 'To do')} />
                    )}
                    <span className="min-w-0">
                      <span className={item.done ? '' : 'font-medium'}>
                        {t(`getFound.${item.key}`, { count: item.count ?? 0 })}
                      </span>
                      <span className="block text-[13px]" style={{ color: MUTED }}>
                        {t(`getFound.${item.key}Why`)}
                      </span>
                      {item.key === 'share_link' && (
                        <button type="button" onClick={() => copy(page.url)} className="mt-1.5 inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
                          <Copy size={14} aria-hidden="true" />
                          {t('getFound.copyLink', 'Copy your page link')}
                        </button>
                      )}
                      {item.key === 'google_profile' && (
                        <a href="https://www.google.com/business/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
                          <ExternalLink size={14} aria-hidden="true" />
                          {t('getFound.openGoogle', 'Open Google Business Profile')}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
