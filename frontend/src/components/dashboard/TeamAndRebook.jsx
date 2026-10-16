/**
 * Listing editor → for an appointment listing: who does it (backend
 * TeamMember: each person their own calendar; customers pick one or
 * "anyone free"), and "suggest booking again after N weeks"
 * (appointment_extras.py). Folded to one line until opened.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Users, ChevronDown, ChevronUp } from 'lucide-react';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
const boxStyle = { borderColor: 'var(--brand-border)' };

export function cleanTeam(team) {
  const seen = new Set();
  return (team || []).map((m) => ({ id: m.id, name: String(m.name || '').trim().slice(0, 40) }))
    .filter((m) => m.name && !seen.has(m.id) && seen.add(m.id));
}

export default function TeamAndRebook({ team, onTeam, rebook, onRebook, deposit, onDeposit, depositNote, onDepositNote }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState((team || []).length > 0 || !!rebook || !!Number(deposit));
  const add = () => {
    let n = (team || []).length + 1;
    const ids = new Set((team || []).map((m) => m.id));
    while (ids.has(`p${n}`)) n += 1;
    onTeam([...(team || []), { id: `p${n}`, name: '' }]);
  };
  return (
    <div className="rounded-lg border" style={boxStyle} data-testid="edit-listing-team">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-start text-sm font-semibold text-gray-700">
        <span className="inline-flex items-center gap-2"><Users size={15} /> {t('team.titleDeposit', 'Who does it, booking again and deposit')}</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-4 text-sm">
          <div>
            <p className="font-semibold text-gray-700">{t('team.people', 'People customers can choose')}</p>
            <p className="text-xs text-gray-600 mb-2">{t('team.peopleHint', 'Each one has their own calendar, so two people can each take the same time. Customers pick someone or “Anyone free”. Leave empty if it is just you.')}</p>
            <ul className="space-y-2">
              {(team || []).map((m, i) => (
                <li key={m.id} className="flex items-center gap-2">
                  <input value={m.name} maxLength={40} dir="auto" placeholder={t('team.namePh', 'Name, e.g. Avi')}
                         onChange={(e) => onTeam(team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                         className={`${box} flex-1`} style={boxStyle} data-testid={`team-name-${i}`} />
                  <button type="button" onClick={() => onTeam(team.filter((_, j) => j !== i))} className="grid place-content-center w-10 h-10 text-red-700"
                          aria-label={t('team.remove', 'Remove')}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {(team || []).length < 20 && (
              <button type="button" onClick={add} className="mt-1 inline-flex items-center gap-1 min-h-[40px] font-semibold" style={{ color: 'var(--ink)' }} data-testid="team-add">
                <Plus size={14} /> {t('team.add', 'Add a person')}
              </button>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-700">{t('team.rebook', 'Remind customers to book again')}</p>
            <p className="text-xs text-gray-600 mb-2">{t('team.rebookHint', 'After an appointment you mark done, the customer gets one email inviting them back, unless they already booked again. They can unsubscribe.')}</p>
            <select value={rebook || ''} onChange={(e) => onRebook(e.target.value ? Number(e.target.value) : null)} className={box} style={boxStyle} data-testid="team-rebook">
              <option value="">{t('team.rebookOff', 'Off')}</option>
              {[1, 2, 3, 4, 6, 8, 12, 26].map((w) => <option key={w} value={w}>{t('team.weeks', 'After {{n}} weeks', { n: w })}</option>)}
            </select>
          </div>
          {onDeposit && (
            <div>
              <p className="font-semibold text-gray-700">{t('deposit.title', 'Deposit to hold the time')}</p>
              <p className="text-xs text-gray-600 mb-2">{t('deposit.hint', 'Customers see it when they book and pay you directly. You tick it off when it arrives. If they cancel at least 24 hours before, it goes back; if they do not come, you can keep it. Leave empty for none.')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span>₪</span>
                <input type="number" min="0" max="5000" value={deposit} onChange={(e) => onDeposit(e.target.value)} className={`${box} w-28`} style={boxStyle} placeholder="0" data-testid="deposit-amount" />
              </div>
              {Number(deposit) > 0 && (
                <textarea rows={2} maxLength={300} dir="auto" value={depositNote} onChange={(e) => onDepositNote(e.target.value)} className={`${box} w-full mt-2`} style={boxStyle}
                          placeholder={t('deposit.notePh', 'How to pay, e.g. Bit to 050-1234567')} data-testid="deposit-note" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
