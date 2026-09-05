/**
 * How a business arranges its own page: what it puts first, and what it
 * groups together.
 *
 * Both fields have existed on the business document since the page was
 * built, and the public page renders both - `pinned_service_ids` above
 * everything (spec C5) and `collections` as the page's sections (C1).
 * Neither had an editor, so the only businesses that ever had either were
 * the ones in the demo seed (dead-ends audit 2026-09-03, #10).
 *
 * Two rules the page already keeps, kept here too so the form and the
 * page agree:
 *
 *  - THREE FEATURED, and the cap is the model's, not the form's. A page
 *    where everything is featured features nothing.
 *  - A SERVICE MAY BE IN SEVERAL GROUPS. A Shabbos package belongs under
 *    both "Shabbos" and "Packages", and making the owner choose serves
 *    nobody. So these are checkboxes, not a single-home picker.
 *
 * Stale ids are the page's problem, not this form's: a service deleted
 * later is skipped when the page is built, so nothing here has to police
 * ids against a list that changes underneath it.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Star, Trash2 } from 'lucide-react';

export const MAX_PINNED = 3;
export const MAX_COLLECTIONS = 8;

let seq = 0;
const newId = () => {
  seq += 1;
  return `c${Date.now().toString(36)}${seq}`;
};

/** A collection worth saving: named, and holding something. */
export const cleanCollections = (list) => (Array.isArray(list) ? list : [])
  .map((c) => ({
    id: c.id || newId(),
    name: String(c.name || '').trim().slice(0, 80),
    description: String(c.description || '').trim().slice(0, 200) || null,
    service_ids: (c.service_ids || []).slice(0, 200),
  }))
  .filter((c) => c.name && c.service_ids.length)
  .slice(0, MAX_COLLECTIONS);

/**
 * @param {Object} props
 * @param {{id: string, title?: string}[]} props.listings The business's own services.
 * @param {string[]} props.pinned
 * @param {(next: string[]) => void} props.onPinnedChange
 * @param {{id: string, name: string, description?: string, service_ids: string[]}[]} props.collections
 * @param {(next: any[]) => void} props.onCollectionsChange
 */
export default function BusinessShelfEditor({
  listings = [],
  pinned = [],
  onPinnedChange,
  collections = [],
  onCollectionsChange,
}) {
  const { t } = useTranslation();
  const services = Array.isArray(listings) ? listings : [];
  const titleOf = (id) => services.find((s) => s.id === id)?.title || id;

  const togglePin = (id) => {
    if (pinned.includes(id)) onPinnedChange(pinned.filter((p) => p !== id));
    else if (pinned.length < MAX_PINNED) onPinnedChange([...pinned, id]);
  };

  const setCollection = (i, patch) => onCollectionsChange(
    collections.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
  );
  const removeCollection = (i) => onCollectionsChange(collections.filter((_, idx) => idx !== i));
  const addCollection = () => {
    if (collections.length >= MAX_COLLECTIONS) return;
    onCollectionsChange([...collections, { id: newId(), name: '', description: '', service_ids: [] }]);
  };
  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= collections.length) return;
    const next = [...collections];
    [next[i], next[j]] = [next[j], next[i]];
    onCollectionsChange(next);
  };
  const toggleInCollection = (i, id) => {
    const ids = collections[i].service_ids || [];
    setCollection(i, {
      service_ids: ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id],
    });
  };

  // Nothing to arrange yet. Said rather than shown as an empty form,
  // which would read as a broken section.
  if (!services.length) {
    return (
      <section className="pt-5 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="page-design-shelf">
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {t('pageDesign.shelf', 'What comes first')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
          {t('pageDesign.shelfNoServices', 'Add a service or two, then you can choose what your page leads with and how it is grouped.')}
        </p>
      </section>
    );
  }

  return (
    <section className="pt-5 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="page-design-shelf">
      {/* ---- Featured (C5) ---- */}
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
        {t('pageDesign.featured', 'Featured first')}
      </h3>
      <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
        {t('pageDesign.featuredHint', 'Up to three, shown at the top of your page. Your judgement about what sells beats any order we could invent.')}
      </p>
      <div className="space-y-1.5" data-testid="page-design-featured">
        {services.map((s) => {
          const on = pinned.includes(s.id);
          const full = !on && pinned.length >= MAX_PINNED;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => togglePin(s.id)}
              disabled={full}
              aria-pressed={on}
              className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-start text-xs disabled:opacity-45"
              style={{
                borderColor: on ? 'var(--brand-primary)' : 'var(--brand-border)',
                background: on ? 'rgb(var(--brand-primary-rgb) / 0.06)' : '#fff',
                color: 'var(--ink)',
              }}
              data-testid={`page-design-feature-${s.id}`}
            >
              <Star
                size={13}
                aria-hidden="true"
                style={{ color: on ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
                fill={on ? 'currentColor' : 'none'}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">{s.title || s.id}</span>
              {on && (
                <span className="shrink-0 text-[10px] font-bold" style={{ color: 'var(--brand-primary)' }}>
                  {pinned.indexOf(s.id) + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--brand-muted)' }} data-testid="page-design-featured-count">
        {t('pageDesign.featuredCount', '{{n}} of {{max}} chosen', { n: pinned.length, max: MAX_PINNED })}
      </p>

      {/* ---- Collections (C1) ---- */}
      <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--brand-border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {t('pageDesign.collections', 'Groups')}
        </h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
          {t('pageDesign.collectionsHint', 'Name a group and tick what belongs in it. A service can sit in more than one. Anything you do not group still shows, under "More from this business".')}
        </p>

        <div className="space-y-3" data-testid="page-design-collections">
          {collections.map((c, i) => (
            <div
              key={c.id || i}
              className="rounded-xl border p-3 space-y-2"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid={`page-design-collection-${i}`}
            >
              <div className="flex gap-1.5">
                <input
                  value={c.name || ''}
                  onChange={(e) => setCollection(i, { name: e.target.value })}
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: 'var(--brand-border)' }}
                  placeholder={t('pageDesign.collectionNamePh', 'e.g. Shabbos packages')}
                  aria-label={t('pageDesign.collectionName', 'Group name')}
                  data-testid={`page-design-collection-name-${i}`}
                />
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg border px-2 disabled:opacity-40"
                  style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
                  aria-label={t('pageDesign.collectionUp', 'Move group up')}
                  data-testid={`page-design-collection-up-${i}`}
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === collections.length - 1}
                  className="rounded-lg border px-2 disabled:opacity-40"
                  style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
                  aria-label={t('pageDesign.collectionDown', 'Move group down')}
                  data-testid={`page-design-collection-down-${i}`}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => {
                  const on = (c.service_ids || []).includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleInCollection(i, s.id)}
                      aria-pressed={on}
                      className="rounded-full border px-2.5 py-1.5 text-[11px] font-semibold"
                      style={on
                        ? { background: 'var(--action, #000)', color: 'var(--action-ink, #fff)', borderColor: 'var(--action, #000)' }
                        : { background: '#fff', color: 'var(--ink)', borderColor: 'var(--brand-border)' }}
                      data-testid={`page-design-collection-${i}-service-${s.id}`}
                    >
                      {s.title || s.id}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
                  {t('pageDesign.collectionCount', '{{n}} in this group', { n: (c.service_ids || []).length })}
                </span>
                <button
                  type="button"
                  onClick={() => removeCollection(i)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: 'var(--brand-muted)' }}
                  data-testid={`page-design-collection-remove-${i}`}
                >
                  <Trash2 size={12} aria-hidden="true" /> {t('pageDesign.collectionRemove', 'Remove group')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {collections.length < MAX_COLLECTIONS && (
          <button
            type="button"
            onClick={addCollection}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary-deep)' }}
            data-testid="page-design-collection-add"
          >
            <Plus size={13} aria-hidden="true" />
            {collections.length
              ? t('pageDesign.collectionAddAnother', 'Add another group')
              : t('pageDesign.collectionAdd', 'Add a group')}
          </button>
        )}

        {/* An unnamed or empty group is dropped on save, and saying so
            beats a group silently vanishing. */}
        {collections.some((c) => !String(c.name || '').trim() || !(c.service_ids || []).length) && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--brand-muted)' }} data-testid="page-design-collection-warning">
            {t('pageDesign.collectionIncomplete', 'A group needs a name and at least one service, or it is not saved.')}
          </p>
        )}
      </div>

      {/* Named here rather than in the featured block: it is the answer to
          "why is my page not in sections", and both halves cause it. */}
      <p className="mt-3 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
        {t('pageDesign.shelfNote', 'Your groups replace the automatic ones. Featured services show above them either way.')}
      </p>
    </section>
  );
}
