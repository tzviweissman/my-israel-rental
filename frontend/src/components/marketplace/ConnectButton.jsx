/**
 * ConnectButton — on another business's page, the viewer's business asks
 * to connect (docs/business-network-spec.md, Phase 1).
 *
 * Shown only to someone who runs at least one business and is not looking
 * at their own. Customers never see it: a connection is between two
 * businesses, and a Connect button in front of someone who came to order
 * bread is noise.
 *
 * The states, all driven by GET /businesses/{mine}/connections/{theirs}:
 *   none / declined / disconnected  ->  Connect (opens an optional note)
 *   pending, I asked                ->  Requested, with Withdraw
 *   pending, they asked             ->  Accept request
 *   accepted                        ->  Connected, with Disconnect
 *
 * A person who runs several businesses picks which one is asking, the same
 * choice the Network tab remembers.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link2, Check, Clock } from 'lucide-react';
import { API } from '../../lib/apiBase';

const REMEMBER = 'network.business';

export default function ConnectButton({ target, token }) {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [mine, setMine] = useState(null);
  const [asId, setAsId] = useState(() => { try { return localStorage.getItem(REMEMBER) || ''; } catch { return ''; } });
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    axios.get(`${API}/marketplace/businesses`, auth)
      .then(({ data }) => {
        if (!alive) return;
        const active = (data || []).filter((b) => b.active && b.id !== target.id);
        setMine(active);
        if (!active.find((b) => b.id === asId) && active[0]) setAsId(active[0].id);
      })
      .catch(() => alive && setMine([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, target.id]);

  const load = useCallback(async () => {
    if (!asId) return;
    try {
      const { data } = await axios.get(`${API}/marketplace/businesses/${asId}/connections/${target.id}`, auth);
      setState(data);
    } catch {
      setState(null);
    }
  }, [asId, target.id, auth]);

  useEffect(() => { load(); }, [load]);

  // Not signed in, owns no business, or owns only THIS one: nothing to show.
  if (!token || !mine || mine.length === 0 || !state || state.status === 'self') return null;

  const call = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      setOpen(false);
      setNote('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('network.failed', 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
      load();
    }
  };

  const send = () => call(
    () => axios.post(`${API}/marketplace/businesses/${asId}/connections`, { target_business_id: target.id, note: note.trim() || null }, auth),
    t('network.sentToast', 'Request sent'),
  );
  const post = (action, ok) => call(() => axios.post(`${API}/marketplace/connections/${state.connection_id}/${action}`, null, auth), ok);

  const pill = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-full font-semibold border';
  const quiet = 'text-xs font-semibold underline underline-offset-2';

  let body;
  if (state.status === 'accepted') {
    body = (
      <div className="flex items-center gap-3 flex-wrap">
        <span className={pill} style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="connect-state-accepted">
          <Check size={15} aria-hidden="true" style={{ color: 'var(--success)' }} /> {t('network.connected', 'Connected')}
        </span>
        <button type="button" disabled={busy} className={quiet} style={{ color: 'var(--brand-muted)' }} onClick={() => post('disconnect', t('network.disconnectedToast', 'Disconnected'))}>
          {t('network.disconnect', 'Disconnect')}
        </button>
      </div>
    );
  } else if (state.status === 'pending' && state.direction === 'outgoing') {
    body = (
      <div className="flex items-center gap-3 flex-wrap">
        <span className={pill} style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} data-testid="connect-state-requested">
          <Clock size={15} aria-hidden="true" /> {t('network.requested', 'Requested')}
        </span>
        <button type="button" disabled={busy} className={quiet} style={{ color: 'var(--brand-muted)' }} onClick={() => post('disconnect', t('network.withdrawnToast', 'Request withdrawn'))}>
          {t('network.withdraw', 'Withdraw')}
        </button>
      </div>
    );
  } else if (state.status === 'pending' && state.direction === 'incoming') {
    body = (
      <button type="button" disabled={busy} className={`${pill} btn-primary border-transparent`} onClick={() => post('accept', t('network.acceptedToast', 'You are now connected'))} data-testid="connect-accept">
        <Check size={15} aria-hidden="true" /> {t('network.acceptRequest', 'Accept request')}
      </button>
    );
  } else if (!open) {
    body = (
      <button type="button" className={pill} style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} onClick={() => setOpen(true)} data-testid="connect-open">
        <Link2 size={15} aria-hidden="true" /> {t('network.connect', 'Connect')}
      </button>
    );
  } else {
    body = (
      <div className="w-full max-w-sm rounded-xl border p-3 bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="connect-form">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }} htmlFor="connect-note">
          {t('network.noteLabel', 'A note (optional)')}
        </label>
        <textarea id="connect-note" rows={2} maxLength={500} dir="auto" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={t('network.notePh', 'For example: we are looking for a courier for Friday deliveries.')}
          className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
        <div className="flex items-center gap-2 mt-2">
          <button type="button" disabled={busy} className="btn-primary px-4 py-2 rounded-full text-sm font-semibold" onClick={send} data-testid="connect-send">
            {t('network.send', 'Send request')}
          </button>
          <button type="button" className={quiet} style={{ color: 'var(--brand-muted)' }} onClick={() => setOpen(false)}>
            {t('network.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="connect-button">
      {mine.length > 1 && (
        <label className="text-xs flex items-center gap-2" style={{ color: 'var(--brand-muted)' }}>
          {t('network.actingAs', 'As')}
          <select value={asId} onChange={(e) => { setAsId(e.target.value); try { localStorage.setItem(REMEMBER, e.target.value); } catch { /* */ } }}
            className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--brand-border)' }}>
            {mine.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}
      {body}
    </div>
  );
}
