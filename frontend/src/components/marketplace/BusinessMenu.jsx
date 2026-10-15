/**
 * The menu on a business page: Home, then each of its extra pages in the
 * owner's order (backend utils/page_composition.py ExtraPage). Nothing
 * when the business has no extra pages. Scrolls sideways on a phone
 * rather than wrapping, so it stays one line.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessPageHref } from '../../utils/businessHost';

export default function BusinessMenu({ business, current = null, preview = false, onPick }) {
  const { t } = useTranslation();
  const pages = business?.pages || [];
  if (!pages.length) return null;
  const slug = business.slug || business.id;
  const items = [{ key: null, label: t('pagesMenu.home', 'Home') }, ...pages.map((p) => ({ key: p.slug, label: p.title }))];
  return (
    <nav aria-label={t('pagesMenu.label', 'Pages')} className="mb-6 -mx-4 px-4 overflow-x-auto" data-testid="business-menu">
      <ul className="flex gap-1.5 min-w-max">
        {items.map((it) => {
          const on = (current || null) === it.key;
          const style = on ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
          const cls = 'inline-flex items-center px-4 min-h-[40px] rounded-full border text-sm font-semibold whitespace-nowrap';
          return (
            <li key={it.key || 'home'}>
              {preview ? (
                <button type="button" className={cls} style={style} aria-current={on ? 'page' : undefined}
                        onClick={() => onPick && onPick(it.key)} dir="auto">{it.label}</button>
              ) : (
                <Link to={businessPageHref(slug, it.key)} className={cls} style={style} aria-current={on ? 'page' : undefined}
                      data-testid={`business-menu-${it.key || 'home'}`} dir="auto">{it.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
