/**
 * Dashboard → Businesses (spec M8).
 *
 * A person can run more than one business — a landlord who also does AC
 * repair, a mover who also sells furniture. Until this screen existed the
 * data model allowed it and nothing let anyone do it.
 *
 * Deactivate rather than delete, deliberately: it hides the business and
 * its listings from the public but keeps its reviews, which are the one
 * thing an owner cannot recreate. The confirm says exactly how many
 * listings will disappear, because "deactivate" on its own does not tell
 * anyone what they are about to hide.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Briefcase, Plus, Loader2, Eye, EyeOff, Check, X, Pencil, Palette } from 'lucide-react';
import { toast } from 'sonner';
import CoverPlaceholder from '../common/CoverPlaceholder';
import BusinessDetailsForm from './BusinessDetailsForm';
import BusinessPageEditor from './BusinessPageEditor';
import BusinessCompleteness from './BusinessCompleteness';
import BlockTimePanel from './BlockTimePanel';
import MyGigsTab from './MyGigsTab';

const MAX_ACTIVE = 5;

export default function MyBusinessesTab({ API, token }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  // Which business is open. The dashboard tab stays put; this is a view
  // WITHIN it, so the tab bar and the browser's back button behave the
  // way someone expects from a dashboard rather than a page tree.
  const [openBiz, setOpenBiz] = useState(null);
  // Which business is having its Good-to-know facts edited (spec C6).
  const [detailsBiz, setDetailsBiz] = useState(null);
  // K3 — which business's PAGE is being designed. A separate full-screen
  // view rather than a third modal: the preview needs the whole width to
  // show a page at the shape a customer reads it in.
  const [designBiz, setDesignBiz] = useState(null);
  const [editName, setEditName] = useState('');

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/marketplace/businesses`, auth);
      setItems(data);
    } catch {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return;
    setBusy(true);
    try {
      await axios.post(`${API}/marketplace/businesses`, { name: clean }, auth);
      setName('');
      setAdding(false);
      await load();
      toast.success(t('businesses.added', 'Business added'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('businesses.addFailed', 'Could not add that business'));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (id) => {
    const clean = editName.trim();
    if (clean.length < 2) return;
    setBusy(true);
    try {
      await axios.patch(`${API}/marketplace/businesses/${id}`, { name: clean }, auth);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('businesses.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (biz) => {
    // Turning one OFF hides listings, so say how many first. Turning one
    // back on takes nothing away and needs no confirmation.
    if (biz.active) {
      const msg = biz.gig_count
        ? t('businesses.confirmHide', {
            defaultValue:
              'Hide "{{name}}"? Its {{n}} listing(s) stop showing publicly. Reviews are kept, and you can switch it back on any time.',
            name: biz.name,
            n: biz.gig_count,
          })
        : t('businesses.confirmHideEmpty', {
            defaultValue: 'Hide "{{name}}"? You can switch it back on any time.',
            name: biz.name,
          });
      // eslint-disable-next-line no-alert
      if (!window.confirm(msg)) return;
    }
    setBusy(true);
    try {
      await axios.patch(`${API}/marketplace/businesses/${biz.id}`, { active: !biz.active }, auth);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('businesses.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  // Inside a business: its own listings, in its own vocabulary.
  const detailsModal = detailsBiz ? (
    <BusinessDetailsForm
      business={detailsBiz}
      API={API}
      token={token}
      onClose={() => setDetailsBiz(null)}
      onSaved={load}
    />
  ) : null;

  if (designBiz) {
    return (
      <BusinessPageEditor
        business={designBiz}
        API={API}
        token={token}
        onClose={() => setDesignBiz(null)}
        onSaved={load}
      />
    );
  }

  if (openBiz) {
    return (
      <MyGigsTab
        API={API}
        token={token}
        business={openBiz}
        onBack={() => { setOpenBiz(null); load(); }}
      />
    );
  }

  if (items === null) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}>
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );
  }

  const activeCount = items.filter((b) => b.active).length;
  const atCap = activeCount >= MAX_ACTIVE;

  return (
    <div data-testid="my-businesses-tab">
      {/* S3a — blocked time is per PERSON, not per business, so it sits
          above the list rather than inside one of the cards. */}
      <BlockTimePanel API={API} token={token} />

      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
          {t('businesses.title', 'Your businesses')}
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={atCap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }}
            data-testid="businesses-add-open"
          >
            <Plus size={13} /> {t('businesses.add', 'Add a business')}
          </button>
        )}
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {atCap
          ? t('businesses.atCap', 'You have the maximum of {{n}} active businesses. Hide one to add another.', { n: MAX_ACTIVE })
          : t('businesses.body', 'Run more than one? Add each separately — they each get their own listings, page and QR code.')}
      </p>

      {adding && (
        <form onSubmit={add} className="flex flex-wrap gap-2 mb-5" data-testid="businesses-add-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('businesses.namePh', 'Business name — e.g. Cohen Movers')}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--brand-border)' }}
            data-testid="businesses-name-input"
          />
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--brand-primary)' }}
            data-testid="businesses-add-submit"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : t('businesses.save', 'Save')}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setName(''); }}
            className="px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ color: 'var(--brand-muted)' }}
          >
            {t('businesses.cancel', 'Cancel')}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
          data-testid="businesses-empty"
        >
          <Briefcase size={22} className="inline mb-2" />
          <p className="text-sm">{t('businesses.empty', 'No businesses yet. Add one to start listing.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border bg-white overflow-hidden"
              style={{ borderColor: 'var(--brand-border)', opacity: b.active ? 1 : 0.6 }}
              data-testid={`business-card-${b.id}`}
            >
              <div className="h-24">
                {b.logo_url ? (
                  <img src={b.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <CoverPlaceholder name={b.name} category={(b.categories || [])[0]} className="w-full h-full" />
                )}
              </div>
              <div className="p-3 space-y-2">
                {editingId === b.id ? (
                  <div className="flex gap-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 rounded border text-sm"
                      style={{ borderColor: 'var(--brand-border)' }}
                      data-testid={`business-rename-input-${b.id}`}
                    />
                    <button type="button" onClick={() => rename(b.id)} disabled={busy}
                      className="p-1.5 rounded" style={{ color: 'var(--brand-primary)' }}
                      data-testid={`business-rename-save-${b.id}`}>
                      <Check size={14} />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="p-1.5 rounded" style={{ color: 'var(--brand-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenBiz(b)}
                    className="block w-full text-start font-semibold text-sm truncate hover:underline"
                    style={{ color: 'var(--ink)' }}
                    title={t('businesses.open', 'Open')}
                    data-testid={`business-name-${b.id}`}
                  >
                    {b.name}
                  </button>
                )}

                {/* B6 — what is still missing from the public page, with
                    each gap wired to the thing that closes it. */}
                <BusinessCompleteness
                  business={b}
                  onEditDetails={() => setDetailsBiz(b)}
                  onOpenListings={() => setOpenBiz(b)}
                />

                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {t('businesses.listingCount', '{{n}} listing(s)', { n: b.gig_count })}
                  {!b.active && ` · ${t('businesses.hidden', 'hidden')}`}
                </p>

                {/* C6 — until this existed the only editable thing about
                    a business was its name, so every fact the public page
                    can show had no way in. */}
                <button
                  type="button"
                  onClick={() => setDetailsBiz(b)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold me-3"
                  style={{ color: 'var(--brand-primary)' }}
                  data-testid={`business-details-${b.id}`}
                >
                  {t('businesses.editDetails', 'Business details')}
                </button>

                {/* K3 — accent, cover and payment links, against a live
                    preview of the page they change. */}
                <button
                  type="button"
                  onClick={() => setDesignBiz(b)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold me-3"
                  style={{ color: 'var(--brand-primary)' }}
                  data-testid={`business-design-${b.id}`}
                >
                  <Palette size={12} /> {t('pageDesign.open', 'Design your page')}
                </button>

                <button
                  type="button"
                  onClick={() => { setEditingId(b.id); setEditName(b.name); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold me-3"
                  style={{ color: 'var(--brand-muted)' }}
                  data-testid={`business-rename-${b.id}`}
                >
                  <Pencil size={12} /> {t('businesses.rename', 'Rename')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(b)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60"
                  style={{ color: b.active ? 'var(--brand-muted)' : 'var(--brand-primary)' }}
                  data-testid={`business-toggle-${b.id}`}
                >
                  {b.active ? <EyeOff size={12} /> : <Eye size={12} />}
                  {b.active ? t('businesses.hide', 'Hide') : t('businesses.show', 'Show')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailsModal}
    </div>
  );
}
