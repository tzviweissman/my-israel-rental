/**
 * "Fill it in for me" (Tzvi, 16 Nov 2026: a business signed up, added nothing, and could not find where
 * to give us his website). The readers the sign-up wizard already has, on the dashboard: a website, an
 * Instagram, Facebook or TikTok link, the business name (Google), or a photo of a flyer. What they find
 * is shown to check, and one Save fills the business page (only what is still empty, never what the
 * owner wrote). Products or services found go on to the wizard, filled in, to check and publish.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, Sparkles, X } from 'lucide-react';
import { API, AuthContext } from '../../App';
import { useOnboarding } from './OnboardingProvider';
import { apiErrorMessage } from '../../utils/apiError';
import { compressImage } from '../../utils/fastUpload';

const ID = 'box.fillForMe';
// The rows an empty business page has not done. Three or more open: the page is close to empty.
const EMPTY_ROWS = ['biz.logo', 'biz.about', 'biz.service', 'biz.areas', 'biz.hours'];
export const FILL_HANDOFF = 'mir-fill';

/** What was typed: a link of one kind (for the site reader), or a name to look up on Google. */
export function kindOf(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/instagram\.com|^@/i.test(s)) return 'instagram';
  if (/facebook\.com|fb\.com/i.test(s)) return 'facebook';
  if (/tiktok\.com/i.test(s)) return 'tiktok';
  if (!/\s/.test(s) && /\.[a-z]{2,}/i.test(s)) return 'website';
  return 'name';
}

// Google's opening hours ({mon: [{start, end}]}) as the one line the business page shows.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function hoursLine(weekly, dayName) {
  if (!weekly) return '';
  return DAY_KEYS.filter((d) => (weekly[d] || []).length)
    .map((d) => `${dayName(d)} ${weekly[d].map((w) => `${w.start}-${w.end}`).join(', ')}`)
    .join(' · ').slice(0, 200);
}

const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border text-base sm:text-sm';
const inputStyle = { borderColor: 'var(--brand-border)', background: 'var(--surface)' };

export default function FillForMe() {
  const { t } = useTranslation();
  const { token } = useContext(AuthContext);
  const ctx = useOnboarding();
  const navigate = useNavigate();
  const [biz, setBiz] = useState(undefined); // undefined loading, null none
  const [locations, setLocations] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState(null);
  const [found, setFound] = useState(null); // the check screen
  const fileRef = useRef(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const lang = (document.documentElement.lang || '').startsWith('he') ? 'he' : 'en';

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/marketplace/businesses`, auth)
      .then(({ data }) => setBiz((data || []).find((b) => b.active) || null))
      .catch(() => setBiz(null));
    axios.get(`${API}/marketplace/locations`).then(({ data }) => setLocations(data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!ctx?.ready || biz === undefined || ctx.dismissed.has(ID)) return null;
  const list = (ctx.state?.checklists || []).find((l) => l.role === 'business');
  if (!list) return null;
  const open = list.items.filter((i) => EMPTY_ROWS.includes(i.id) && !i.done).length;
  if (open < 3 && !found) return null;

  const dayName = (d) => t(`fillForMe.day.${d}`, d);
  const slugFor = (area) => {
    const a = (area || '').toLowerCase();
    return locations.filter((l) => a.includes((l.label || '').toLowerCase())).map((l) => l.slug).slice(0, 6);
  };

  // Every reader ends here: one shape, shown to check.
  const show = (fields, { links = {}, pictures = null, hours = '' } = {}) => {
    if (!fields || (!fields.business_name && !fields.title && !fields.description && !(fields.items || []).length)) {
      toast(t('fillForMe.nothing', 'We could not find much there. Try your website, or your business name as Google knows it.'), { duration: 8000 });
      return;
    }
    setFound({
      fields,
      links,
      name: biz?.name || fields.business_name || fields.title || '',
      description: biz?.description ? '' : (fields.description || ''),
      hours: biz?.hours ? '' : (fields.hours || hours || ''),
      address: biz?.address ? '' : (fields.address || ''),
      area: fields.area || '',
      logo: !biz?.logo_url && pictures?.logo ? pictures.logo : '',
      cover: !biz?.cover_url && pictures?.cover ? pictures.cover : '',
      useLogo: true,
      useCover: true,
      items: fields.items || [],
    });
    setMatches(null);
  };

  const readLink = async (kind, value) => {
    const { data } = await axios.post(`${API}/marketplace/socials/read`, { links: { [kind]: value } }, auth);
    return data;
  };

  const go = async () => {
    const kind = kindOf(text);
    if (!kind) { toast.error(t('fillForMe.empty', 'Type your website, Instagram or business name first')); return; }
    setBusy(true);
    try {
      if (kind === 'name') {
        const { data } = await axios.get(`${API}/marketplace/find-business`, { params: { q: text.trim(), lang } });
        if (!(data.results || []).length) toast(t('fillForMe.noMatch', 'Google does not know that name. Try your website or Instagram instead.'), { duration: 8000 });
        else setMatches(data.results);
      } else {
        const data = await readLink(kind, text.trim());
        show(data.fields, { links: data.links, pictures: data.pictures });
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fillForMe.failed', 'Could not read that. Try another link, or fill it in yourself below.'), t), { duration: 8000 });
    } finally { setBusy(false); }
  };

  // A Google match: its details, and when Google knows its website, the website too (it has the products).
  const pick = async (place) => {
    setBusy(true);
    try {
      const { data: g } = await axios.get(`${API}/marketplace/find-business/${place.id}`, { params: { lang } });
      const fromGoogle = {
        business_name: g.name, title: g.name, category: g.category, subcategory: g.subcategory,
        area: g.area, whatsapp: g.whatsapp, description: g.description, items: [],
      };
      let site = null;
      if (g.website) site = await readLink('website', g.website).catch(() => null);
      const f = site?.fields || {};
      show({ ...fromGoogle, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v && (!Array.isArray(v) || v.length))) },
        { links: site?.links || (g.website ? { website: g.website } : {}), pictures: site?.pictures, hours: hoursLine(g.weekly_availability, dayName) });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fillForMe.failed', 'Could not read that. Try another link, or fill it in yourself below.'), t));
    } finally { setBusy(false); }
  };

  const flyer = async (file) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', await compressImage(file), 'flyer.jpg');
      const { data } = await axios.post(`${API}/marketplace/ad/extract`, body, auth);
      show(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fillForMe.failed', 'Could not read that. Try another link, or fill it in yourself below.'), t), { duration: 8000 });
    } finally { setBusy(false); }
  };

  const save = async () => {
    const f = found;
    setBusy(true);
    try {
      const wanted = [f.useLogo && f.logo, f.useCover && f.cover].filter(Boolean);
      let ours = {};
      if (wanted.length) {
        const { data } = await axios.post(`${API}/marketplace/socials/pictures`, { urls: wanted }, auth).catch(() => ({ data: {} }));
        ours = Object.fromEntries(wanted.map((u, i) => [u, (data.urls || [])[i]]).filter(([, v]) => v));
      }
      const areas = biz?.areas?.length || biz?.serves_nationwide ? [] : slugFor(f.area);
      // Only what is still empty on the business: never over what the owner wrote.
      const patch = {
        ...(f.description.trim() ? { description: f.description.trim() } : {}),
        ...(f.hours.trim() ? { hours: f.hours.trim().slice(0, 200) } : {}),
        ...(f.address.trim() ? { address: f.address.trim().slice(0, 200) } : {}),
        ...(areas.length ? { areas } : {}),
        ...(f.useLogo && ours[f.logo] ? { logo_url: ours[f.logo] } : {}),
        ...(f.useCover && ours[f.cover] ? { cover_url: ours[f.cover] } : {}),
        ...(Object.keys(f.links).length ? { socials: { ...(biz?.socials || {}), ...f.links } } : {}),
      };
      let id = biz?.id;
      if (!biz) {
        if (f.name.trim().length < 2) { toast.error(t('fillForMe.needName', 'Add your business name')); return; }
        const { data } = await axios.post(`${API}/marketplace/businesses`, { name: f.name.trim(), ...patch }, auth);
        id = data.id;
      } else if (Object.keys(patch).length) {
        await axios.patch(`${API}/marketplace/businesses/${biz.id}`, patch, auth);
      }
      ctx.refresh?.();
      const offer = list.items.find((i) => i.id === 'biz.service' && !i.done);
      if (offer) {
        // The wizard picks this up (CreateGig, ?fill=1) and fills its form with it, to check and publish.
        try { sessionStorage.setItem(FILL_HANDOFF, JSON.stringify({ ...f.fields, business_name: f.name, socials: f.links })); } catch { /* private mode */ }
        toast.success(t('fillForMe.savedNext', 'Your business page is filled in. Now check what you offer and publish it.'));
        navigate(`/businesses/add?business=${id}&fill=1`);
      } else {
        toast.success(t('fillForMe.saved', 'Your business page is filled in.'));
        setFound(null);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fillForMe.saveFailed', 'Could not save that. Try again.'), t));
    } finally { setBusy(false); }
  };

  const box = 'rounded-2xl border p-4 sm:p-5 mb-6';
  const boxStyle = { background: 'var(--surface)', borderColor: 'var(--brand-border)' };
  const primary = 'px-4 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 min-h-[44px]';
  const primaryStyle = { background: 'var(--action)', color: 'var(--action-ink)' };

  if (found) {
    const set = (p) => setFound((x) => ({ ...x, ...p }));
    const field = (key, label, area) => (
      <label className="block">
        <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{label}</span>
        {area
          ? <textarea rows={3} dir="auto" value={found[key]} onChange={(e) => set({ [key]: e.target.value })} className={inputCls} style={inputStyle} data-testid={`fill-${key}`} />
          : <input dir="auto" value={found[key]} onChange={(e) => set({ [key]: e.target.value })} className={inputCls} style={inputStyle} data-testid={`fill-${key}`} />}
      </label>
    );
    const pic = (key, useKey, label) => found[key] && (
      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <input type="checkbox" checked={found[useKey]} onChange={(e) => set({ [useKey]: e.target.checked })} />
        <img src={found[key]} alt="" className="w-14 h-14 rounded-lg object-cover border" style={{ borderColor: 'var(--brand-border)' }} />
        <span>{label}</span>
      </label>
    );
    return (
      <section className={box} style={boxStyle} data-testid="fill-for-me-check">
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          {t('fillForMe.checkTitle', 'Here is what we found')}
        </h2>
        <p className="text-sm mt-1 mb-4" style={{ color: 'var(--brand-muted)' }}>
          {t('fillForMe.checkLead', 'Change anything that is wrong, then save. We only fill what is still empty.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {!biz && field('name', t('fillForMe.name', 'Business name'))}
          {!biz?.description && <div className="sm:col-span-2">{field('description', t('fillForMe.about', 'About your business'), true)}</div>}
          {!biz?.hours && field('hours', t('fillForMe.hours', 'Opening hours'))}
          {!biz?.address && field('address', t('fillForMe.address', 'Address'))}
          {!(biz?.areas?.length || biz?.serves_nationwide) && field('area', t('fillForMe.area', 'Town or city'))}
        </div>
        {(found.logo || found.cover) && (
          <div className="flex flex-wrap gap-4 mt-4">
            {pic('logo', 'useLogo', t('fillForMe.logo', 'Use as your logo'))}
            {pic('cover', 'useCover', t('fillForMe.cover', 'Use as your main picture'))}
          </div>
        )}
        {found.items.length > 0 && (
          <div className="mt-4 text-sm" data-testid="fill-items">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>
              {t('fillForMe.items', { count: found.items.length, defaultValue: '{{count}} things you offer' })}
            </p>
            <p style={{ color: 'var(--brand-muted)' }}>
              {found.items.slice(0, 5).map((i) => i.name).join(', ')}{found.items.length > 5 ? '…' : ''}
            </p>
            <p className="mt-1" style={{ color: 'var(--brand-muted)' }}>{t('fillForMe.itemsNext', 'After saving you check these, with their prices and photos, and publish.')}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          <button type="button" onClick={save} disabled={busy} className={primary} style={primaryStyle} data-testid="fill-save">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t('fillForMe.save', 'Save to my business page')}
          </button>
          <button type="button" onClick={() => setFound(null)} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]" style={{ color: 'var(--brand-muted)' }}>
            {t('fillForMe.back', 'Start again')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${box} relative`} style={boxStyle} data-testid="fill-for-me">
      <button type="button" onClick={() => ctx.dismiss(ID)} aria-label={t('fillForMe.notNow', 'Not now')}
        className="absolute top-2 end-2 p-2 rounded-lg" style={{ color: 'var(--brand-muted)' }} data-testid="fill-dismiss">
        <X size={18} />
      </button>
      <div className="flex items-start gap-3 pe-8">
        <Sparkles size={22} className="shrink-0 mt-1" style={{ color: 'var(--gold)' }} aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('fillForMe.title', 'Let us fill in your page for you')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('fillForMe.lead', 'Give us your website, Instagram or Facebook, or just your business name. We read what you already show customers, and you check it before anything is saved.')}
          </p>
        </div>
      </div>
      <form className="flex flex-col sm:flex-row gap-2 mt-4" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <input dir="auto" value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
          placeholder={t('fillForMe.placeholder', 'Website, @instagram or business name')}
          aria-label={t('fillForMe.placeholder', 'Website, @instagram or business name')}
          className="flex-1 px-3 py-2 rounded-lg border text-base min-h-[44px]" style={inputStyle} data-testid="fill-input" />
        <button type="submit" disabled={busy} className={primary} style={primaryStyle} data-testid="fill-go">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? t('fillForMe.reading', 'Reading, about a minute…') : t('fillForMe.go', 'Fill it in for me')}
        </button>
      </form>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold min-h-[44px]" style={{ color: 'var(--gold)' }} data-testid="fill-flyer">
        <Camera size={16} aria-hidden="true" /> {t('fillForMe.flyer', 'Or add a photo of your flyer or menu')}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) flyer(f); }} />
      {matches && (
        <ul className="mt-3 border rounded-lg divide-y" style={{ borderColor: 'var(--brand-border)' }} data-testid="fill-matches">
          <li className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{t('fillForMe.whichOne', 'Which one is yours?')}</li>
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => pick(m)} disabled={busy} className="w-full text-start px-3 py-2 min-h-[44px] hover:bg-gray-50">
                <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{m.name}</span>
                <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{m.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
