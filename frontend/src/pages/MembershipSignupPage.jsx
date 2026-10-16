/**
 * /memberships/:slug: a business's plans, and joining one with no
 * account (routes/marketplace/memberships.py). The sign-up waits for the
 * business to confirm payment; the page says so plainly, and hands the
 * member the link to their pass.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, Check, Users } from 'lucide-react';
import { API } from '../lib/apiBase';
import { planPrice, planVisits } from '../components/members/memberText';
import CustomFieldInputs from '../components/forms/CustomFieldInputs';
import DiscountCodeInput, { discountOn } from '../components/forms/DiscountCodeInput';
import BirthdayInput, { birthdayOrNull } from '../components/forms/BirthdayInput';
import { money } from '../utils/currency';

const field = 'w-full px-3 py-2 rounded-lg border text-base bg-white min-h-[48px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function MembershipSignupPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const refCode = params.get('ref');
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' });
  const [answers, setAnswers] = useState({});
  const [code, setCode] = useState(null);
  const [birthday, setBirthday] = useState('');
  const [timetable, setTimetable] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/marketplace/memberships/${encodeURIComponent(slug)}`)
      .then(({ data: d }) => { setData(d); if (d.plans.length === 1) setPick(d.plans[0].id); })
      .catch(() => setData(false));
    // The week's classes, if the business runs any (backend classes.py).
    axios.get(`${API}/marketplace/memberships/${encodeURIComponent(slug)}/timetable`).then(({ data: d }) => setTimetable(d || [])).catch(() => {});
  }, [slug]);

  if (data === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (data === false || data.plans.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 pb-24 text-center" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 48px)' }} data-testid="memberships-none">
        <Users size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('members.noSignup', 'Memberships are not open here right now')}</h1>
      </div>
    );
  }
  const biz = data.business;
  const bizName = (lang === 'he' && biz.name_he) || biz.name;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const { data: r } = await axios.post(`${API}/marketplace/memberships/plan/${pick}/join`, {
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, note: form.note.trim() || null, lang: lang === 'he' ? 'he' : 'en', answers, discount_code: code ? code.code : null,
        birthday: biz.birthday_on ? birthdayOrNull(birthday) : null,
      });
      navigate(`/members/${r.manage_token}?joined=1`);
    } catch (err) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : t('members.joinFailed', 'Could not send. Check your details and try again.'));
    } finally { setSending(false); }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="membership-signup">
      <main className="max-w-xl mx-auto px-4 pb-16" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 28px)' }}>
        <div className="flex items-center gap-3 mb-2">
          {biz.logo_url && <img src={biz.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
              {t('members.joinTitle', 'Join {{name}}', { name: bizName })}
            </h1>
            {biz.slug && <Link to={`/business/${biz.slug}`} className="text-sm" style={{ color: 'var(--gold-text-on-light, #167AB8)' }}>{t('members.aboutBiz', 'About {{name}}', { name: bizName })}</Link>}
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>{t('members.joinBody', 'Choose a plan and leave your details. No account needed. The business will contact you about payment and then activate your membership.')}</p>

        <form onSubmit={submit} className="space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('members.choosePlan', 'Choose a plan')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.plans.map((p) => {
                const on = pick === p.id;
                return (
                  <label key={p.id} className="relative block rounded-2xl border bg-white p-4 cursor-pointer" data-testid="signup-plan"
                         style={{ borderColor: on ? 'var(--ink)' : 'var(--brand-border)', boxShadow: on ? '0 0 0 1px var(--ink)' : 'none' }}>
                    <input type="radio" name="plan" value={p.id} checked={on} onChange={() => setPick(p.id)} className="sr-only" />
                    {on && <Check size={18} className="absolute top-3 end-3" style={{ color: 'var(--ink)' }} />}
                    <span className="block font-semibold" style={{ color: 'var(--ink)' }}>{p.name}</span>
                    <span className="block text-lg font-bold mt-1" style={{ color: 'var(--ink)' }}>{planPrice(t, p)}</span>
                    <span className="block text-sm" style={{ color: 'var(--brand-muted)' }}>{planVisits(t, p)}</span>
                    {p.description && <span className="block text-sm mt-2" style={{ color: 'var(--ink)' }}>{p.description}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {timetable.length > 0 && (
            <section data-testid="signup-timetable">
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('classes.timetableTitle', "This week's classes")}</h2>
              <ul className="rounded-2xl border bg-white divide-y" style={{ borderColor: 'var(--brand-border)' }}>
                {timetable.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 px-3 py-2 text-sm" style={{ color: 'var(--ink)', borderColor: 'var(--brand-border)' }}>
                    <span>{new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short' }).format(new Date(`${c.date}T00:00`))} {c.start} · {c.title}</span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--brand-muted)' }}>{c.spots_left > 0 ? t('classes.left', '{{n}} places left', { n: c.spots_left }) : t('classes.full', 'Full')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('members.yourDetails', 'Your details')}</legend>
            <input required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={set('name')} className={field} style={fieldStyle} placeholder={t('members.name', 'Full name')} data-testid="signup-name" />
            <input required type="tel" minLength={7} maxLength={20} autoComplete="tel" value={form.phone} onChange={set('phone')} className={field} style={fieldStyle} placeholder={t('members.phone', 'Phone')} data-testid="signup-phone" />
            <input type="email" maxLength={200} autoComplete="email" value={form.email} onChange={set('email')} className={field} style={fieldStyle} placeholder={t('members.emailForPass', 'Email, to get your membership pass (optional)')} />
            <textarea maxLength={500} rows={2} value={form.note} onChange={set('note')} className={field} style={fieldStyle} placeholder={t('members.noteOptional', 'Anything the business should know (optional)')} />
            <CustomFieldInputs fields={data.fields} values={answers} onChange={setAnswers} testid="signup-custom-fields" />
            {biz.birthday_on && <BirthdayInput value={birthday} onChange={setBirthday} businessName={bizName} testid="signup-birthday" />}
          </fieldset>

          {(() => {
            const plan = data.plans.find((p) => p.id === pick);
            const off = plan ? discountOn(code, Number(plan.price || 0)) : 0;
            return (
              <div>
                <DiscountCodeInput businessId={biz.id} form="memberships" amount={plan ? Number(plan.price || 0) : 0} phone={form.phone} applied={code} onApplied={setCode} initialCode={refCode} />
                {plan && off > 0 && (
                  <p className="text-sm mt-1" style={{ color: 'var(--ink)' }} data-testid="signup-discount">
                    {t('discounts.memberPrice', '{{price}} instead of {{was}}', { price: money(Number(plan.price) - off, plan.currency || 'ILS'), was: money(plan.price, plan.currency || 'ILS') })}
                  </p>
                )}
              </div>
            );
          })()}
          {error && <p className="text-sm" role="alert" style={{ color: '#B42318' }}>{error}</p>}
          <button type="submit" disabled={!pick || sending} className="w-full inline-flex justify-center items-center gap-2 min-h-[52px] rounded-full text-base font-semibold disabled:opacity-60"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="signup-submit">
            {sending && <Loader2 size={16} className="animate-spin" />} {t('members.signUp', 'Sign up')}
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--brand-muted)' }}>{t('members.noChargeNote', 'Nothing is charged on this site. You arrange payment with the business.')}</p>
        </form>
      </main>
    </div>
  );
}
