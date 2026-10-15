/**
 * Design your page → Pages (Tzvi, 15 Oct 2026: "extra pages and menu").
 * Home plus up to eight more pages; pick one to edit its sections below
 * (SectionsEditor) and see it in the preview. New pages start from a
 * template (About, FAQ, Contact, Gallery, Blank) the owner then changes.
 * Order here is the order of the menu on the business page.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Plus, FileText } from 'lucide-react';

export const MAX_PAGES = 8;

function slugify(title, taken, fallback) {
  const base = String(title || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;
  let s = base;
  let n = 2;
  while (taken.has(s)) { s = `${base.slice(0, 36)}-${n}`; n += 1; }
  return s;
}

function templateBlocks(kind, t, business) {
  const photos = [];
  if (business.cover_url) photos.push('cover');
  (business.listings || []).forEach((g) => { if (g && g.id) photos.push(`listing:${g.id}`); });
  switch (kind) {
    case 'about': return [{ id: 'text-1', type: 'text', variant: photos.length ? 'photo' : 'plain', props: { heading: t('pages.tpl.aboutHeading', 'Who we are'), body: '', image: photos[0] || null } }];
    case 'faq': return [{ id: 'text-1', type: 'text', variant: 'plain', props: { heading: t('pages.tpl.faqHeading', 'Questions customers ask'), body: '', image: null } }];
    case 'contact': return [{ id: 'contact-1', type: 'contact', variant: 'stack', props: {} }, { id: 'facts-1', type: 'facts', variant: 'list', props: {} }];
    case 'gallery': return [{ id: 'gallery-1', type: 'gallery', variant: 'carousel', props: { images: photos.slice(0, 12) } }];
    default: return [{ id: 'text-1', type: 'text', variant: 'plain', props: { heading: '', body: '', image: null } }];
  }
}

export default function PagesEditor({ pages, onChange, editing, onEdit, business }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const TEMPLATES = [
    ['about', t('pages.tpl.about', 'About us')],
    ['faq', t('pages.tpl.faq', 'Questions')],
    ['contact', t('pages.tpl.contact', 'Contact')],
    ['gallery', t('pages.tpl.gallery', 'Gallery')],
    ['blank', t('pages.tpl.blank', 'Blank page')],
  ];

  const add = (kind, title) => {
    const taken = new Set(pages.map((p) => p.slug));
    const ids = new Set(pages.map((p) => p.id));
    let n = pages.length + 1;
    while (ids.has(`page-${n}`)) n += 1;
    const page = { id: `page-${n}`, slug: slugify(kind === 'blank' ? '' : kind, taken, `page-${n}`), title, blocks: templateBlocks(kind, t, business) };
    onChange([...pages, page]);
    onEdit(page.id);
    setAdding(false);
  };
  const update = (i, patch) => onChange(pages.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i) => {
    if (!window.confirm(t('pages.confirmRemove', 'Remove this page? Its sections go with it.'))) return;
    if (editing === pages[i].id) onEdit(null);
    onChange(pages.filter((_, j) => j !== i));
  };

  const row = 'flex items-center gap-1 rounded-xl border ps-2 pe-1 py-1';
  const iconBtn = 'grid place-content-center w-9 h-9 rounded-lg disabled:opacity-30';
  return (
    <section data-testid="pages-editor">
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('pages.title', 'Pages')}</h3>
      <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
        {t('pages.hint', 'Your main page, and more pages if you want them. With more than one, a menu at the top links them. Pick a page to change its sections below.')}
      </p>
      <ol className="space-y-2">
        <li>
          <button type="button" onClick={() => onEdit(null)} className={`${row} w-full text-start min-h-[44px] text-sm font-semibold`}
                  style={{ borderColor: editing === null ? 'var(--ink)' : 'var(--brand-border)', color: 'var(--ink)' }} data-testid="pages-home">
            {t('pagesMenu.home', 'Home')}
          </button>
        </li>
        {pages.map((p, i) => (
          <li key={p.id} className={row} style={{ borderColor: editing === p.id ? 'var(--ink)' : 'var(--brand-border)' }} data-testid={`pages-row-${p.slug}`}>
            <FileText size={14} aria-hidden="true" style={{ color: 'var(--brand-muted)' }} className="shrink-0" />
            <input value={p.title} maxLength={40} dir="auto" onFocus={() => onEdit(p.id)} onChange={(e) => update(i, { title: e.target.value })}
                   className="flex-1 min-w-0 px-2 min-h-[40px] text-sm font-semibold bg-transparent outline-none" style={{ color: 'var(--ink)' }}
                   aria-label={t('pages.name', 'Page name')} data-testid={`pages-title-${p.slug}`} />
            <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('sections.up', 'Move up')}><ChevronUp size={15} /></button>
            <button type="button" className={iconBtn} disabled={i === pages.length - 1} onClick={() => move(i, 1)} aria-label={t('sections.down', 'Move down')}><ChevronDown size={15} /></button>
            <button type="button" className={iconBtn} onClick={() => remove(i)} aria-label={t('pages.remove', 'Remove page')} data-testid={`pages-remove-${p.slug}`}><Trash2 size={15} /></button>
          </li>
        ))}
      </ol>
      {pages.length < MAX_PAGES && (adding ? (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="pages-add-menu">
          {TEMPLATES.map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => add(kind, label)} className="px-3 min-h-[40px] rounded-full border text-sm font-semibold"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`pages-add-${kind}`}>{label}</button>
          ))}
          <button type="button" onClick={() => setAdding(false)} className="text-xs underline px-2" style={{ color: 'var(--brand-muted)' }}>{t('sections.cancel', 'Cancel')}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full border text-sm font-semibold"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="pages-add">
          <Plus size={14} /> {t('pages.add', 'Add a page')}
        </button>
      ))}
    </section>
  );
}
