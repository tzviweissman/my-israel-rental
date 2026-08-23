import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { CalendarOff, Plus, X, Loader2 } from 'lucide-react';

/**
 * Time the owner is not available (spec S3a).
 *
 * Built first of the WhatsApp-booking pieces, and deliberately: an owner
 * needs this whatever else exists. Holidays, a dentist appointment, a
 * walk-in, a job taken over the phone — without a way to say "not then",
 * the calendar can never be true, and no amount of clever handling of
 * WhatsApp leads fixes a calendar that lies.
 *
 * Per PERSON, not per listing. Someone at a wedding is unavailable for
 * everything they offer, and asking them to block each listing
 * separately is busywork that guarantees one gets forgotten.
 *
 * Collapsed by default. It is a thing you reach for occasionally, not
 * something to put in front of someone every time they open the
 * dashboard — but the count is visible without opening it, because
 * "did I remember to block Thursday?" is the actual question.
 */
export default function BlockTimePanel({ API, token }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', start_time: '09:00', end_time: '17:00', note: '' });

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/marketplace/blocks`, auth);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.date) { toast.error(t('blocks.pickDate', 'Pick a date first')); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/marketplace/blocks`, form, auth);
      setForm({ date: '', start_time: '09:00', end_time: '17:00', note: '' });
      await load();
      toast.success(t('blocks.added', 'Time blocked'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('blocks.failed', 'Could not block that time'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${API}/marketplace/blocks/${id}`, auth);
      await load();
    } catch {
      toast.error(t('blocks.failed', 'Could not block that time'));
    }
  };

  const count = rows?.length ?? 0;

  return (
    <div className="rounded-2xl border bg-white mb-4" style={{ borderColor: 'var(--brand-border)' }}
      data-testid="block-time-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start"
        data-testid="block-time-toggle"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <CalendarOff size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
          {t('blocks.title', 'Time I am not available')}
        </span>
        <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
          {count > 0
            ? t('blocks.count', '{{n}} upcoming', { n: count })
            : t('blocks.none', 'nothing blocked')}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('blocks.hint', 'Customers cannot book these times on any of your services.')}
          </p>

          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[9rem]">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>
                {t('blocks.date', 'Date')}
              </span>
              <input type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="block-date" />
            </label>
            <label>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>
                {t('blocks.from', 'From')}
              </span>
              <input type="time" value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="mt-0.5 px-2 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="block-start" />
            </label>
            <label>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>
                {t('blocks.to', 'To')}
              </span>
              <input type="time" value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="mt-0.5 px-2 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="block-end" />
            </label>
            <label className="flex-1 min-w-[10rem]">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>
                {t('blocks.note', 'Note (optional)')}
              </span>
              <input value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder={t('blocks.notePh', 'Wedding, holiday…')}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="block-note" />
            </label>
            <button type="button" onClick={add} disabled={saving}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: 'var(--brand-primary)' }}
              data-testid="block-add">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {t('blocks.add', 'Block')}
            </button>
          </div>

          {rows === null ? (
            <Loader2 size={15} className="animate-spin" style={{ color: 'var(--brand-muted)' }} />
          ) : rows.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="block-empty">
              {t('blocks.emptyState', 'Nothing blocked. Your opening hours apply as normal.')}
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm py-1"
                  data-testid={`block-row-${r.id}`}>
                  <span style={{ color: 'var(--ink)' }}>
                    {r.date} · {r.start_time}–{r.end_time}
                    {r.note && <span style={{ color: 'var(--brand-muted)' }}> · {r.note}</span>}
                  </span>
                  {/* One click to free it again — nothing depends on a
                      block having existed, so it needs no confirmation. */}
                  <button type="button" onClick={() => remove(r.id)}
                    aria-label={t('blocks.remove', 'Remove')}
                    data-testid={`block-remove-${r.id}`}>
                    <X size={14} style={{ color: 'var(--brand-muted)' }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
