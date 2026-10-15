/**
 * Design your page → Sections (Tzvi, 15 Oct 2026: "start with the section
 * editor", Shopify's theme editor). The page's sections in order: move one
 * up or down, hide it, remove it, open it to change its words and photos,
 * or add a new one. Every change reaches the preview beside it at once;
 * Save in the editor stores them (`page.blocks`, backend
 * utils/page_composition.py, which checks every one again).
 *
 * The header (name, logo, cover) and the reviews and footer are the
 * page's frame, not sections, and stay where they are.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Plus, Pencil, X } from 'lucide-react';
import { BLOCK_TYPES, MAX_BLOCKS, resolveImage } from '../../utils/pageComposition';
import { getGigCover } from '../../utils/gigAvailability';

const box = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const iconBtn = 'grid place-content-center w-9 h-9 rounded-lg disabled:opacity-30';

/** What each kind of section is called and says it is, for the owner. */
export const sectionText = (t) => ({
  hero: [t('sections.type.hero', 'Big photo banner'), t('sections.about.hero', 'A large photo with a headline over it.')],
  text: [t('sections.type.text', 'Text and photo'), t('sections.about.text', 'Your own words, with a photo beside them if you like.')],
  services: [t('sections.type.services', 'Your services and products'), t('sections.about.services', 'What you offer, with prices.')],
  gallery: [t('sections.type.gallery', 'Photo gallery'), t('sections.about.gallery', 'Your photos, one after another.')],
  facts: [t('sections.type.facts', 'Good to know'), t('sections.about.facts', 'Hours, languages, kashrut and licence, from your business details.')],
  providers: [t('sections.type.providers', 'Top rated'), t('sections.about.providers', 'Your best-reviewed services. Shows once you have reviews.')],
  contact: [t('sections.type.contact', 'Message button'), t('sections.about.contact', 'A button for customers to message you.')],
  cover: [t('sections.type.cover', 'Cover band'), t('sections.about.cover', 'A wide band with your cover photo or colour.')],
  sizes: [t('sections.type.sizes', 'Sizes to scale'), t('sections.about.sizes', 'One listing’s products drawn to scale. Needs 3 measured products.')],
  rule: [t('sections.type.rule', 'Divider'), t('sections.about.rule', 'A line between sections.')],
});

const VARIANT_KEYS = {
  hero: { band: 'Full width', compact: 'Shorter' },
  text: { plain: 'Text only', photo: 'With a photo' },
  services: { grid: 'Grid', list: 'List' },
  cover: { photo: 'Photo', tint: 'Colour' },
  rule: { skyline: 'Skyline', hairline: 'Thin line' },
};

// The order sections are offered in: the ones most owners want first.
const ADDABLE = ['text', 'hero', 'gallery', 'services', 'facts', 'contact', 'providers', 'cover', 'sizes', 'rule'];

/** The pictures this business has that a section may show. */
function imageChoices(business) {
  const out = [];
  if (business.cover_url) out.push('cover');
  if (business.logo_url) out.push('logo');
  (business.listings || []).forEach((g) => { if (g && g.id && getGigCover(g)) out.push(`listing:${g.id}`); });
  return out;
}

function defaultProps(type, business) {
  const imgs = imageChoices(business);
  switch (type) {
    case 'services': return { source: 'all', heading: '', limit: 12 };
    case 'text': return { heading: '', body: '', image: imgs[0] || null };
    case 'gallery': return { images: imgs.slice(0, 6) };
    case 'sizes': return { listing: (business.listings || [])[0]?.id || '', heading: '' };
    case 'cover': return { height: 'm' };
    case 'rule': return { tone: 'border', size: 'm' };
    case 'providers': return { limit: 3 };
    default: return {};
  }
}

function newId(type, blocks) {
  const taken = new Set(blocks.map((b) => b.id));
  let n = 1;
  while (taken.has(`${type}-${n}`)) n += 1;
  return `${type}-${n}`;
}

function ImagePick({ business, value, onChange, multi = false }) {
  const { t } = useTranslation();
  const choices = imageChoices(business);
  if (!choices.length) return <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('sections.noPhotos', 'Add a cover photo or a photo to a service first.')}</p>;
  const picked = multi ? (value || []) : [value];
  const toggle = (ref) => {
    if (!multi) return onChange(ref);
    return onChange(picked.includes(ref) ? picked.filter((r) => r !== ref) : [...picked, ref].slice(0, 12));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((ref) => {
        const on = picked.includes(ref);
        return (
          <button key={ref} type="button" onClick={() => toggle(ref)} aria-pressed={on}
                  className="w-16 h-16 rounded-lg overflow-hidden border-2" style={{ borderColor: on ? 'var(--ink)' : 'var(--brand-border)', opacity: on ? 1 : 0.6 }}
                  aria-label={t('sections.photo', 'Photo')}>
            <img src={resolveImage(business, ref, getGigCover)} alt="" className="w-full h-full object-cover" />
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{label}<div className="mt-1">{children}</div></label>;
}

function Settings({ block, business, onProps, onVariant }) {
  const { t } = useTranslation();
  const p = block.props || {};
  const set = (k) => (e) => onProps({ [k]: e.target.value });
  const variants = BLOCK_TYPES[block.type] || [];
  return (
    <div className="space-y-3 pt-2" data-testid={`section-settings-${block.id}`}>
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-1" role="radiogroup">
          {variants.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={block.variant === v} onClick={() => onVariant(v)}
                    className="px-3 min-h-[36px] rounded-full text-xs font-semibold border"
                    style={block.variant === v ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : boxStyle}>
              {t(`sections.variant.${block.type}_${v}`, VARIANT_KEYS[block.type]?.[v] || v)}
            </button>
          ))}
        </div>
      )}
      {block.type === 'hero' && (<>
        <Field label={t('sections.headline', 'Headline')}><input className={box} style={boxStyle} maxLength={80} dir="auto" value={p.title || ''} onChange={set('title')} placeholder={business.name} /></Field>
        <Field label={t('sections.accentWord', 'Words in colour at the end (optional)')}><input className={box} style={boxStyle} maxLength={40} dir="auto" value={p.accent_word || ''} onChange={set('accent_word')} /></Field>
        <Field label={t('sections.lede', 'Line under it (optional)')}><input className={box} style={boxStyle} maxLength={200} dir="auto" value={p.lede || ''} onChange={set('lede')} /></Field>
        <Field label={t('sections.photo', 'Photo')}><ImagePick business={business} value={p.image} onChange={(v) => onProps({ image: v })} /></Field>
      </>)}
      {block.type === 'text' && (<>
        <Field label={t('sections.heading', 'Heading')}><input className={box} style={boxStyle} maxLength={80} dir="auto" value={p.heading || ''} onChange={set('heading')} data-testid={`section-heading-${block.id}`} /></Field>
        <Field label={t('sections.body', 'Text')}><textarea className={box} style={boxStyle} rows={5} maxLength={1500} dir="auto" value={p.body || ''} onChange={set('body')} data-testid={`section-body-${block.id}`} /></Field>
        {block.variant === 'photo' && <Field label={t('sections.photo', 'Photo')}><ImagePick business={business} value={p.image} onChange={(v) => onProps({ image: v })} /></Field>}
      </>)}
      {block.type === 'services' && (<>
        <Field label={t('sections.heading', 'Heading')}><input className={box} style={boxStyle} maxLength={60} dir="auto" value={p.heading || ''} onChange={set('heading')} placeholder={t('sections.servicesPh', 'e.g. Our cakes')} /></Field>
        <Field label={t('sections.show', 'Show')}>
          <select className={box} style={boxStyle} value={p.source === 'featured' ? 'featured' : 'all'} onChange={(e) => onProps({ source: e.target.value })}>
            <option value="all">{t('sections.showAll', 'Everything')}</option>
            <option value="featured">{t('sections.showFeatured', 'Only the ones you pinned')}</option>
          </select>
        </Field>
        <Field label={t('sections.limit', 'How many at most')}><input type="number" min="1" max="48" className={box} style={boxStyle} value={p.limit ?? 12} onChange={(e) => onProps({ limit: Math.max(1, Math.min(48, Number(e.target.value) || 1)) })} /></Field>
      </>)}
      {block.type === 'gallery' && <Field label={t('sections.photos', 'Photos (tap to add or remove)')}><ImagePick business={business} multi value={p.images} onChange={(v) => onProps({ images: v })} /></Field>}
      {block.type === 'sizes' && (
        <Field label={t('sections.listing', 'Which listing')}>
          <select className={box} style={boxStyle} value={p.listing || ''} onChange={set('listing')}>
            {(business.listings || []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </Field>
      )}
      {block.type === 'cover' && (
        <Field label={t('sections.height', 'Height')}>
          <select className={box} style={boxStyle} value={p.height || 'm'} onChange={set('height')}>
            <option value="s">{t('sections.small', 'Small')}</option><option value="m">{t('sections.medium', 'Medium')}</option><option value="l">{t('sections.large', 'Large')}</option>
          </select>
        </Field>
      )}
      {block.type === 'providers' && <Field label={t('sections.limit', 'How many at most')}><input type="number" min="1" max="8" className={box} style={boxStyle} value={p.limit ?? 3} onChange={(e) => onProps({ limit: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} /></Field>}
      {(block.type === 'facts' || block.type === 'contact') && (
        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('sections.fromDetails', 'Nothing to set here: it shows what is in your business details.')}</p>
      )}
    </div>
  );
}

export default function SectionsEditor({ blocks, onChange, business }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const names = sectionText(t);

  const update = (i, patch) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i) => { if (blocks.length > 1) onChange(blocks.filter((_, j) => j !== i)); };
  const add = (type) => {
    const b = { id: newId(type, blocks), type, variant: BLOCK_TYPES[type][type === 'text' ? 1 : 0], props: defaultProps(type, business) };
    onChange([...blocks, b]);
    setAdding(false);
    setOpen(b.id);
  };
  const canAdd = (type) => type !== 'sizes' || (business.listings || []).length > 0;

  return (
    <section data-testid="sections-editor">
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('sections.title', 'Sections')}</h3>
      <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
        {t('sections.hint', 'What your page shows under your name, in order. Move, hide or change any of them, or add a new one.')}
      </p>
      <ol className="space-y-2">
        {blocks.map((b, i) => {
          const [name] = names[b.type] || [b.type];
          const isOpen = open === b.id;
          return (
            <li key={b.id} className="rounded-xl border" style={{ borderColor: isOpen ? 'var(--ink)' : 'var(--brand-border)', opacity: b.hidden ? 0.6 : 1 }} data-testid={`section-${b.id}`}>
              <div className="flex items-center gap-1 ps-3 pe-1 py-1">
                <button type="button" onClick={() => setOpen(isOpen ? null : b.id)} className="flex-1 min-w-0 text-start min-h-[40px] text-sm font-semibold truncate" style={{ color: 'var(--ink)' }} data-testid={`section-open-${b.id}`}>
                  {name}
                  {b.type === 'text' && b.props?.heading ? <span className="font-normal" style={{ color: 'var(--brand-muted)' }}> · {b.props.heading}</span> : null}
                  {b.hidden && <span className="font-normal text-xs" style={{ color: 'var(--brand-muted)' }}> · {t('sections.hidden', 'hidden')}</span>}
                </button>
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('sections.up', 'Move up')} data-testid={`section-up-${b.id}`}><ChevronUp size={15} /></button>
                <button type="button" className={iconBtn} disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={t('sections.down', 'Move down')} data-testid={`section-down-${b.id}`}><ChevronDown size={15} /></button>
                <button type="button" className={iconBtn} onClick={() => update(i, { hidden: !b.hidden })} aria-pressed={!!b.hidden}
                        aria-label={b.hidden ? t('sections.show', 'Show') : t('sections.hide', 'Hide')} data-testid={`section-hide-${b.id}`}>
                  {b.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button type="button" className={iconBtn} disabled={blocks.length <= 1} onClick={() => remove(i)} aria-label={t('sections.remove', 'Remove')} data-testid={`section-remove-${b.id}`}><Trash2 size={15} /></button>
                <button type="button" className={iconBtn} onClick={() => setOpen(isOpen ? null : b.id)} aria-label={t('sections.edit', 'Edit')}>{isOpen ? <X size={15} /> : <Pencil size={14} />}</button>
              </div>
              {isOpen && (
                <div className="px-3 pb-3">
                  <Settings block={b} business={business}
                            onProps={(patch) => update(i, { props: { ...(b.props || {}), ...patch } })}
                            onVariant={(v) => update(i, { variant: v })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {blocks.length < MAX_BLOCKS && (adding ? (
        <div className="mt-2 rounded-xl border p-2 space-y-1" style={{ borderColor: 'var(--brand-border)' }} data-testid="section-add-menu">
          {ADDABLE.filter(canAdd).map((type) => (
            <button key={type} type="button" onClick={() => add(type)} className="w-full text-start rounded-lg px-3 py-2 hover:bg-gray-50" data-testid={`section-add-${type}`}>
              <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{names[type][0]}</span>
              <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{names[type][1]}</span>
            </button>
          ))}
          <button type="button" onClick={() => setAdding(false)} className="text-xs underline px-3 min-h-[36px]" style={{ color: 'var(--brand-muted)' }}>{t('sections.cancel', 'Cancel')}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full border text-sm font-semibold"
                style={boxStyle} data-testid="section-add">
          <Plus size={14} /> {t('sections.add', 'Add a section')}
        </button>
      ))}
    </section>
  );
}
