/**
 * PostRequest — /requests/post. Open to everyone; the account is asked for
 * at the final step (C4), not at the door.
 *
 * Anyone can fill the whole thing in signed out. On submit without a token
 * the draft is parked in sessionStorage, they are sent to /join, and they
 * come back to the last step with every answer intact. Posting still
 * requires an account — the server enforces that regardless of the UI —
 * but the ask now lands when the reason for it is obvious rather than
 * before they have seen what they are signing up for.
 *
 * A five-step wizard rather than one long form (C2 of the marketplace
 * research). Airtasker runs this exact product and asks one question per
 * screen with the steps listed in a rail; the reasons that matter here:
 *
 *   • a single column of a dozen inputs reads as paperwork, and this is the
 *     one screen where a hesitant seeker decides whether to bother;
 *   • short questions translate cleanly into Hebrew. Long compound field
 *     labels do not — they end up as a clause with the verb in the wrong
 *     place, which is how half our Hebrew UI got stilted;
 *   • per-step validation means the Next button can say what is missing at
 *     the moment it is missing, instead of the user discovering on submit
 *     that something ten fields up was wrong.
 *
 * Both sides of the market go through it: "I'm looking for" and "I have
 * available". The first step is which of those, because it changes how
 * every question after it reads.
 *
 * State lives in one object for the whole wizard, so stepping backwards
 * never loses an answer. Nothing is sent until the final step.
 *
 * The variant rule is unchanged and still load-bearing: the backend
 * requires `rental_kind` on a rental and `category` on a service and
 * rejects the post otherwise, so the wizard must not let anyone reach the
 * end without the field their type needs.
 */
import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Home, Wrench, Loader2, ArrowLeft, ArrowRight, Search, KeyRound, Check,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import DateModePills from '../components/requests/DateModePills';
import AreaCombobox from '../components/requests/AreaCombobox';
import Combobox from '../components/common/Combobox';
import DateField from '../components/common/DateField';
import { useReturnDestination, backLabelFor } from '../hooks/useBackNavigation';
import { groupCategories, flattenGrouped } from '../lib/categoryGroups';

const RENTAL_KINDS = ['long-term', 'short-term', 'vacation'];

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand-muted)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{hint}</p>}
  </div>
);

const inputCls = 'w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-primary)]';

// C4 — the draft, parked across the sign-in round trip.
//
// sessionStorage rather than localStorage: it is the same store the auth
// token uses, it dies with the tab, and a half-written post is not
// something to leave on a shared machine for a week.
//
// The draft is the whole form object. Keeping only "the fields they had
// filled" would mean deciding what counts as filled, and getting that
// wrong loses someone's typing — the exact failure this feature exists to
// prevent.
const DRAFT_KEY = 'requests_post_draft';

const readDraft = () => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupt or unavailable storage must not take the page down with it —
    // a lost draft is a bad afternoon, a blank page is a lost user.
    return null;
  }
};
const writeDraft = (form, step) => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
  } catch { /* private mode, quota — posting still works, just without the parachute */ }
};
const clearDraft = () => {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* nothing to do */ }
};

/** Big card used by the two choose-one steps. */
const ChoiceCard = ({ active, Icon, label, sub, onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="rounded-xl border p-4 text-start transition-colors w-full"
    style={{
      borderColor: active ? 'var(--brand-primary)' : 'var(--brand-border)',
      background: active ? 'rgb(var(--brand-primary-rgb) / 0.06)' : '#fff',
    }}
    data-testid={testid}
  >
    <Icon size={18} style={{ color: 'var(--brand-primary)' }} />
    <span className="block mt-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>{label}</span>
    {sub && <span className="block mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{sub}</span>}
  </button>
);

const PostRequest = () => {
  // Where the back button goes: the dashboard if that is where they came
  // from, otherwise the board. Same rule on every posting page.
  const backTo = useReturnDestination(['/dashboard', '/requests'], '/requests');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);

  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  // The furthest step reached, which is what the rail lets you jump back
  // TO and FORWARD to. Without this, stepping back greyed out everything
  // ahead: the answers were all still there, but the only way forward was
  // Next, Next, Next, and a wizard that makes you walk past your own
  // finished answers reads exactly like one that threw them away.
  const [furthest, setFurthest] = useState(0);
  const [form, setForm] = useState({
    request_type: 'rental',
    title: '',
    description: '',
    area: '',
    budget_type: 'open',
    budget_amount: '',
    budget_currency: 'ILS',
    // rental
    rental_kind: 'long-term',
    bedrooms_min: '',
    post_kind: 'want',
    listing_id: '',
    whatsapp: '',
    date_mode: 'on',
    move_in_date: '',
    lease_months: '',
    // service
    category: '',
    preferred_date: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isRental = form.request_type === 'rental';
  // Supply-side post — flips the wizard's questions from asking to offering.
  const isOffer = form.post_kind === 'have';

  // The poster's own listings, for the optional link on a "have" post.
  // Fetched only once they say they have something — a seeker never sees
  // this field, so there is no reason to spend the request on them.
  const [myListings, setMyListings] = useState([]);
  useEffect(() => {
    if (!isOffer || !user?.id) return;
    let alive = true;
    axios.get(`${API}/properties`, { params: { owner_id: user.id, limit: 100 } })
      .then((r) => { if (alive) setMyListings(r.data || []); })
      // Silent: the field is optional, and an owner with no listings and an
      // owner whose fetch failed both just see no picker.
      .catch(() => {});
    return () => { alive = false; };
  }, [isOffer, user?.id]);

  // Restore a draft parked before sign-in, once, on mount. Landing back
  // here after signing up and finding the form empty is worse than having
  // been asked to sign up first, so this runs before anything else can
  // touch the form.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const draft = readDraft();
    if (!draft?.form) return;
    setForm((f) => ({ ...f, ...draft.form }));
    // Back to the step they were on — which is the last one, since that is
    // the only place the sign-in ask happens.
    if (typeof draft.step === 'number') { setStep(draft.step); setFurthest(draft.step); }
    clearDraft();
    setRestored(true);
  }, []);

  useEffect(() => {
    axios.get(`${API}/marketplace/categories`)
      .then((r) => setCategories(r.data || []))
      .catch(() => setCategories([]));
  }, []);

  // One entry per step. `blocker` mirrors the server's own validation for
  // the fields on THAT step, so Next can refuse with the reason attached
  // rather than letting someone walk to the end and meet a 400.
  const STEPS = useMemo(() => [
    {
      key: 'what',
      label: t('requests.stepWhat', 'What you are posting'),
      blocker: () => null, // both choices always have a value
    },
    {
      key: 'about',
      label: t('requests.stepAbout', 'Title and details'),
      blocker: () => {
        if (form.title.trim().length < 6) return t('requests.needTitle', 'Give your post a title (at least 6 characters).');
        if (form.description.trim().length < 10) return t('requests.needDescription', 'Add a few more details — at least 10 characters.');
        return null;
      },
    },
    {
      key: 'where',
      label: t('requests.stepWhere', 'Location'),
      blocker: () => (form.area.trim().length < 2 ? t('requests.needArea', 'Which area?') : null),
    },
    {
      key: 'when',
      label: t('requests.stepWhen', 'Specifics and timing'),
      blocker: () => (!isRental && !form.category ? t('requests.needCategory', 'Pick a service category.') : null),
    },
    {
      key: 'budget',
      // Someone offering a flat is naming a price, not declaring a budget.
      label: isOffer ? t('requests.stepPrice', 'Price') : t('requests.stepBudget', 'Budget'),
      blocker: () => (form.budget_type === 'fixed' && !(Number(form.budget_amount) > 0)
        ? t('requests.needBudget', 'Enter a budget amount, or switch to "open to offers".')
        : null),
    },
  ], [t, form, isRental, isOffer]);

  const current = STEPS[step];
  const blocker = current.blocker();
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (blocker) { toast.error(blocker); return; }
    setStep((s) => {
      const to = Math.min(s + 1, STEPS.length - 1);
      setFurthest((f) => Math.max(f, to));
      return to;
    });
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Jump straight to any step already visited. Going forward still has to
  // pass every step in between — otherwise someone could reach the end
  // around a question they had emptied on the way back — but it stops AT
  // the offending step and says why, rather than refusing silently.
  const jumpTo = (i) => {
    if (i === step) return;
    if (i < step) { setStep(i); return; }
    if (i > furthest) return;
    for (let k = step; k < i; k += 1) {
      const why = STEPS[k].blocker();
      if (why) { setStep(k); toast.error(why); return; }
    }
    setStep(i);
  };

  const submit = async (e) => {
    e.preventDefault();
    // Re-check every step, not just this one. Someone can reach the end and
    // then edit an earlier answer into an invalid state by stepping back.
    const firstBad = STEPS.findIndex((s) => s.blocker());
    if (firstBad !== -1) {
      setStep(firstBad);
      toast.error(STEPS[firstBad].blocker());
      return;
    }
    // C4 — the account ask, at the end rather than the beginning. They
    // have written the whole thing by now, so the reason for an account is
    // self-evident, and the draft comes back with them.
    if (!token) {
      writeDraft(form, STEPS.length - 1);
      toast.message(t('requests.signInToPost', 'One last step — create an account so people can reply to you. Your post is saved.'));
      navigate(`/join?redirect=${encodeURIComponent('/requests/post')}`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        request_type: form.request_type,
        post_kind: form.post_kind,
        date_mode: form.date_mode,
        listing_id: isOffer ? (form.listing_id || null) : null,
        whatsapp: form.whatsapp.trim() || null,
        title: form.title.trim(),
        description: form.description.trim(),
        area: form.area.trim(),
        budget_type: form.budget_type,
        budget_amount: form.budget_type === 'fixed' ? Number(form.budget_amount) : null,
        budget_currency: form.budget_currency,
        ...(isRental
          ? {
              rental_kind: form.rental_kind,
              bedrooms_min: form.bedrooms_min === '' ? null : Number(form.bedrooms_min),
              move_in_date: form.date_mode === 'flexible' ? null : (form.move_in_date || null),
              lease_months: form.lease_months === '' ? null : Number(form.lease_months),
            }
          : {
              category: form.category,
              preferred_date: form.date_mode === 'flexible' ? null : (form.preferred_date || null),
            }),
      };
      const { data } = await axios.post(`${API}/marketplace/requests`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(isOffer
        ? t('requests.postedOffer', 'Your post is live — renters can now reach you.')
        : t('requests.posted', 'Your request is live — owners and pros can now reach you.'));
      navigate(`/requests/${data.id}`);
    } catch (err) {
      // The server owns the real rules (open cap, cooldown); surface its
      // message rather than inventing a generic one.
      toast.error(err.response?.data?.detail || t('requests.postFailed', 'Could not post'));
    } finally {
      setSaving(false);
    }
  };

  const dateField = (
    <Field label={isRental
      ? t('requests.fieldMoveIn', 'Move-in date')
      : t('requests.fieldPreferredDate', 'Preferred date')}
    >
      <DateModePills
        value={form.date_mode}
        onChange={(m) => set({ date_mode: m })}
        t={t}
        testidPrefix="post-request-date-mode"
      />
      {form.date_mode !== 'flexible' && (
        <DateField
          className={`${inputCls} mt-2`} style={{ borderColor: 'var(--brand-border)' }}
          value={isRental ? form.move_in_date : form.preferred_date}
          onChange={(v) => set(isRental ? { move_in_date: v } : { preferred_date: v })}
          min={new Date().toISOString().slice(0, 10)}
          testid={isRental ? 'post-request-movein' : 'post-request-preferred-date'}
        />
      )}
    </Field>
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="post-request-page"
    >
      <PageMeta
        title="Post to the marketplace | MyIsraelRental"
        description="Say what you are looking for, or what you have available."
        path="/requests/post"
        noindex
      />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: 'var(--brand-muted)' }}
          data-testid="post-request-back"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {backLabelFor(backTo, t, 'requests.backToBoard', 'Back to the board')}
        </button>

        <div className="grid gap-8 md:grid-cols-[210px_1fr]">
          {/* Step rail. Airtasker lists the steps rather than showing a bare
              "3 of 5", because knowing what is still coming is what makes a
              multi-step form feel shorter than one long one rather than
              longer. Horizontal and scrollable on a phone, where a vertical
              rail would push the actual question below the fold. */}
          <ol
            className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible scrollbar-hide"
            data-testid="post-request-steps"
          >
            {STEPS.map((s, i) => {
              const done = i !== step && i <= furthest;
              const active = i === step;
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    disabled={i > furthest}
                    aria-current={active ? 'step' : undefined}
                    className="flex items-center gap-2 rounded-full md:rounded-xl px-3 py-2 text-[13px] font-semibold w-full text-start transition-colors disabled:cursor-default"
                    style={{
                      background: active ? 'rgb(var(--brand-primary-rgb) / 0.08)' : 'transparent',
                      color: active || done ? 'var(--brand-primary)' : 'var(--brand-muted)',
                    }}
                    data-testid={`post-request-step-${s.key}`}
                  >
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
                      style={{
                        background: done || active ? 'var(--brand-primary)' : 'rgba(35,32,27,.08)',
                        color: done || active ? '#fff' : 'var(--brand-muted)',
                      }}
                    >
                      {done ? <Check size={11} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap md:whitespace-normal">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <form onSubmit={submit} data-testid="post-request-form">
            <h1
              className="text-2xl sm:text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              data-testid="post-request-heading"
            >
              {current.key === 'what' && (isOffer
                ? t('requests.postTitleOffer', 'What do you have available?')
                : t('requests.postTitle', 'What are you looking for?'))}
              {current.key === 'about' && (isOffer
                ? t('requests.qAboutOffer', 'Describe what you have')
                : t('requests.qAbout', 'In a few words, what do you need?'))}
              {current.key === 'where' && t('requests.qWhere', 'Where?')}
              {current.key === 'when' && t('requests.qWhen', 'The specifics')}
              {current.key === 'budget' && (isOffer
                ? t('requests.qBudgetOffer', 'What are you asking?')
                : t('requests.qBudget', 'What is your budget?'))}
            </h1>
            <p className="text-sm mb-7" style={{ color: 'var(--brand-muted)' }}>
              {isOffer
                ? t('requests.postSubOffer', 'Free to post. Renters reply through on-platform chat — your phone and email are never shown. For a full listing with photos and pricing, list it on Stays instead.')
                : t('requests.postSub', 'Free to post. Owners and pros reply through on-platform chat — your phone and email are never shown.')}
            </p>

            <div className="space-y-5">
              {current.key === 'what' && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3" data-testid="post-request-kind">
                    <ChoiceCard
                      active={form.post_kind === 'want'} Icon={Search}
                      label={t('requests.kindWant', "I'm looking for something")}
                      sub={t('requests.kindWantSub', 'Owners and pros come to you')}
                      onClick={() => set({ post_kind: 'want' })}
                      testid="post-request-kind-want"
                    />
                    <ChoiceCard
                      active={form.post_kind === 'have'} Icon={KeyRound}
                      label={t('requests.kindHave', 'I have something available')}
                      sub={t('requests.kindHaveSub', 'No photos or price needed')}
                      onClick={() => set({ post_kind: 'have' })}
                      testid="post-request-kind-have"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <ChoiceCard
                      active={isRental} Icon={Home}
                      label={isOffer
                        ? t('requests.typeRentalOffer', 'A place to rent out')
                        : t('requests.typeRentalLong', "I'm looking for a place")}
                      onClick={() => set({ request_type: 'rental' })}
                      testid="post-request-type-rental"
                    />
                    <ChoiceCard
                      active={!isRental} Icon={Wrench}
                      label={isOffer
                        ? t('requests.typeServiceOffer', 'A service I provide')
                        : t('requests.typeServiceLong', 'I need a service')}
                      onClick={() => set({ request_type: 'service' })}
                      testid="post-request-type-service"
                    />
                  </div>
                </>
              )}

              {current.key === 'about' && (
                <>
                  <Field label={t('requests.fieldTitle', 'Title')}>
                    <input
                      className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                      value={form.title} onChange={(e) => set({ title: e.target.value })}
                      /* FOUR variants, not two. This branched on rental
                         vs service only, so somebody under the heading
                         "Describe what you have" was shown "e.g. Mover
                         needed on the 14th" — an example of the opposite
                         of what they were doing. Every example here has to
                         match the KIND of post as well as its type. */
                      placeholder={isRental
                        ? (isOffer
                          ? t('requests.titlePhRentalOffer', 'e.g. 3-bed in Ramat Eshkol, free from September')
                          : t('requests.titlePhRental', 'e.g. 3-bed wanted in Ramat Eshkol'))
                        : (isOffer
                          ? t('requests.titlePhServiceOffer', 'e.g. Mover with a van, Jerusalem area')
                          : t('requests.titlePhService', 'e.g. Mover needed on the 14th'))}
                      maxLength={140} data-testid="post-request-title"
                    />
                  </Field>
                  <Field label={t('requests.fieldDescription', 'Details')}>
                    <textarea
                      className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                      rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })}
                      /* The offer copy was rental-only — "the floor, the
                         light" says nothing to a plumber advertising a
                         service. */
                      placeholder={isOffer
                        ? (isRental
                          ? t('requests.descriptionPhOffer', 'What makes it worth a look — the floor, the light, when it is free.')
                          : t('requests.descriptionPhOfferService', 'What you do, who you do it for, and where you work.'))
                        : t('requests.descriptionPh', 'The things that would make an offer right or wrong for you.')}
                      maxLength={4000} data-testid="post-request-description"
                    />
                  </Field>
                </>
              )}

              {current.key === 'where' && (
                <Field
                  label={t('requests.fieldArea', 'Area')}
                  hint={t('requests.areaHint', 'A neighbourhood is more useful than a city — it is how people search here.')}
                >
                  {/* Type-ahead over the canonical area list. Free text is
                      still accepted, but a pick from the list spells the
                      area the same way the listings do — which is what the
                      matching email and the board filter actually match on.
                      A typo here is a request nobody is told about. */}
                  <AreaCombobox
                    value={form.area}
                    onChange={(v) => set({ area: v })}
                    className={inputCls}
                    style={{ borderColor: 'var(--brand-border)' }}
                    placeholder={t('requests.areaPh', 'Start typing — e.g. Ramat Eshkol')}
                    emptyHint={t('requests.areaFreeText', 'Not on our list? Type it anyway — it still posts.')}
                    testid="post-request-area"
                  />
                </Field>
              )}

              {current.key === 'when' && (
                isRental ? (
                  <div className="grid sm:grid-cols-2 gap-4" data-testid="post-request-rental-fields">
                    <Field label={t('requests.fieldRentalKind', 'Rental type')}>
                      <select
                        className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                        value={form.rental_kind} onChange={(e) => set({ rental_kind: e.target.value })}
                        data-testid="post-request-rental-kind"
                      >
                        {RENTAL_KINDS.map((k) => (
                          <option key={k} value={k}>{t(`requests.rentalKind_${k}`, k)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={isOffer
                      ? t('requests.fieldBedroomsOffer', 'Bedrooms')
                      : t('requests.fieldBedrooms', 'Bedrooms (minimum)')}>
                      <input
                        type="number" min="0" max="20" inputMode="numeric"
                        className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                        value={form.bedrooms_min} onChange={(e) => set({ bedrooms_min: e.target.value })}
                        placeholder={isOffer
                          ? t('requests.bedroomsPhOffer', 'e.g. 3')
                          : t('requests.bedroomsPh', 'e.g. 3 — leave blank if it does not matter')}
                        data-testid="post-request-bedrooms"
                      />
                    </Field>
                    {dateField}
                    <Field label={t('requests.fieldLease', 'Lease length (months)')}>
                      <input
                        type="number" min="1" max="120" inputMode="numeric"
                        className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                        value={form.lease_months} onChange={(e) => set({ lease_months: e.target.value })}
                        placeholder={t('requests.leasePh', 'e.g. 12 — optional')}
                        data-testid="post-request-lease"
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4" data-testid="post-request-service-fields">
                    <Field label={t('requests.fieldCategory', 'Category')}>
                      {/* Categories behind a select you cannot type into
                          means hunting for a word you already know.
                          allowFreeText is off: the value is a slug the API
                          validates, so an unmatched string would only earn
                          a 400 — it reverts to the last valid choice
                          instead.

                          Grouped order plus a group hint per row (spec
                          N2); a filtered list cannot carry headings, so
                          the hint is how a row still says where it sits.
                          maxSuggestions is raised because the default of 8
                          hid everything past the eighth category from
                          anyone browsing rather than typing. */}
                      <Combobox
                        value={form.category}
                        onChange={(v) => set({ category: v })}
                        options={flattenGrouped(groupCategories(categories, t))
                          .map((c) => ({ value: c.slug, label: c.label, hint: c.groupLabel }))}
                        maxSuggestions={40}
                        allowFreeText={false}
                        icon={Wrench}
                        className={inputCls}
                        style={{ borderColor: 'var(--brand-border)' }}
                        placeholder={t('requests.pickCategory', 'Type or pick a category…')}
                        emptyHint={t('requests.noCategoryMatch', 'No category matches that — try a shorter word.')}
                        testid="post-request-category"
                      />
                    </Field>
                    {dateField}
                  </div>
                )
              )}

              {current.key === 'budget' && (
                <>
                  <Field label={isOffer
                    ? (isRental
                      ? t('requests.fieldAskingRent', 'Asking rent')
                      : t('requests.fieldPrice', 'Price'))
                    : t('requests.fieldBudget', 'Budget')}>
                    <div className="flex flex-wrap gap-2 items-center">
                      {['open', 'fixed'].map((v) => (
                        <button
                          key={v} type="button" onClick={() => set({ budget_type: v })}
                          aria-pressed={form.budget_type === v}
                          className="px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
                          style={{
                            borderColor: form.budget_type === v ? 'var(--brand-primary)' : 'var(--brand-border)',
                            background: form.budget_type === v ? 'var(--brand-primary)' : '#fff',
                            color: form.budget_type === v ? '#fff' : 'var(--ink)',
                          }}
                          data-testid={`post-request-budget-${v}`}
                        >
                          {v === 'open' ? t('requests.budgetOpen', 'Open to offers') : t('requests.budgetFixed', 'I have a budget')}
                        </button>
                      ))}
                      {form.budget_type === 'fixed' && (
                        <>
                          <input
                            type="number" min="1"
                            className="rounded-xl border bg-white px-3 py-2 text-sm w-32 outline-none"
                            style={{ borderColor: 'var(--brand-border)' }}
                            value={form.budget_amount} onChange={(e) => set({ budget_amount: e.target.value })}
                            placeholder="8000" data-testid="post-request-budget-amount"
                          />
                          <select
                            className="rounded-xl border bg-white px-3 py-2 text-sm outline-none"
                            style={{ borderColor: 'var(--brand-border)' }}
                            value={form.budget_currency} onChange={(e) => set({ budget_currency: e.target.value })}
                            data-testid="post-request-budget-currency"
                          >
                            <option value="ILS">₪ ILS</option>
                            <option value="USD">$ USD</option>
                          </select>
                        </>
                      )}
                    </div>
                  </Field>

                  {/* WhatsApp, entirely opt-in.
                      The board's rule is chat-only and no contact detail of
                      any kind is public — this is the one exception and it
                      belongs to the poster: they type their own number, for
                      their own post, and the copy says plainly what it
                      means. Left blank, nothing changes and chat stays the
                      only route.
                      The number is never shown on the board even when
                      given; the button goes through a redirect that counts
                      the click and then hands over to WhatsApp. */}
                  <Field
                    label={t('requests.fieldWhatsapp', 'WhatsApp number (optional)')}
                    hint={t('requests.whatsappHint', 'Add it and people can message you on WhatsApp as well as here. Your number is not shown on the board — it opens WhatsApp when someone taps the button. Leave it blank to keep replies on-site only.')}
                  >
                    <input
                      type="tel"
                      inputMode="tel"
                      className={inputCls}
                      style={{ borderColor: 'var(--brand-border)' }}
                      value={form.whatsapp}
                      onChange={(e) => set({ whatsapp: e.target.value })}
                      placeholder={t('requests.whatsappPh', 'e.g. 050-123-4567')}
                      maxLength={40}
                      data-testid="post-request-whatsapp"
                    />
                  </Field>

                  {/* Optional link to a listing the poster already has here.
                      Only on a supply-side post, and only if they actually
                      have one — an empty dropdown is a dead end that implies
                      a missing step. A picker of their own listings rather
                      than a URL box: this board is public, and a free link
                      field on it would be a phishing vector wearing our
                      chrome. */}
                  {isOffer && myListings.length > 0 && (
                    <Field label={t('requests.fieldLinkListing', 'Link one of your listings (optional)')}>
                      <select
                        className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                        value={form.listing_id} onChange={(e) => set({ listing_id: e.target.value })}
                        data-testid="post-request-listing"
                      >
                        <option value="">{t('requests.noListingLink', 'No listing — just this post')}</option>
                        {myListings.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs" style={{ color: 'var(--brand-muted)' }}>
                        {t('requests.linkListingHelp', 'Anyone reading your post can jump straight to the full listing, with photos and price.')}
                      </p>
                    </Field>
                  )}
                </>
              )}
            </div>

            {isLast && !token && (
              <p
                className="mt-6 rounded-xl border px-4 py-3 text-xs"
                style={{ borderColor: 'var(--brand-border)', background: '#fff', color: 'var(--brand-muted)' }}
                data-testid="post-request-signin-note"
              >
                {t('requests.signInWhy', 'You will be asked to create an account when you post — that is how replies reach you, and it takes a moment. Nothing you have written is lost.')}
              </p>
            )}
            {restored && token && (
              <p
                className="mt-6 rounded-xl border px-4 py-3 text-xs"
                style={{ borderColor: 'var(--brand-border)', background: '#fff', color: 'var(--ink)' }}
                data-testid="post-request-restored"
              >
                {t('requests.draftRestored', 'Welcome back — your post is exactly as you left it. Press post to publish it.')}
              </p>
            )}
            <div className="flex items-center gap-3 mt-8">
              {step > 0 && (
                <button
                  type="button" onClick={back}
                  className="btn btn-ghost !py-[9px] !px-5 !text-sm inline-flex items-center gap-1.5"
                  data-testid="post-request-prev"
                >
                  <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden="true" />
                  {t('requests.wizardBack', 'Back')}
                </button>
              )}
              {/* Distinct `key`s are load-bearing, not tidiness. Without
                  them React sees a <button> at the same position in the
                  same parent and REUSES the DOM node, mutating type from
                  "button" to "submit" in place. The click that advanced the
                  step is still mid-flight, so the browser then runs the
                  default action against an element that has become a submit
                  button — and the form posted itself the moment you reached
                  the last step. Two keys, two nodes, no reuse. */}
              {isLast ? (
                <button
                  key="submit"
                  type="submit" disabled={saving}
                  className="btn-blue-solid inline-flex items-center gap-2 disabled:opacity-60"
                  data-testid="post-request-submit"
                >
                  {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {!token
                    ? t('requests.submitSignedOut', 'Create an account and post')
                    : isOffer
                      ? t('requests.submitOffer', 'Post it')
                      : t('requests.submit', 'Post my request')}
                </button>
              ) : (
                <button
                  key="next"
                  type="button" onClick={next}
                  className="btn-blue-solid inline-flex items-center gap-2"
                  data-testid="post-request-next"
                >
                  {t('requests.wizardNext', 'Next')}
                  <ArrowRight size={14} className="rtl:rotate-180" aria-hidden="true" />
                </button>
              )}
              <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('requests.stepCount', 'Step {{n}} of {{total}}', { n: step + 1, total: STEPS.length })}
              </span>
            </div>
            {/* The blocker is shown rather than only toasted, so someone who
                dismissed the toast can still see why Next will not move. */}
            {blocker && (
              <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }} data-testid="post-request-blocker">
                {blocker}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostRequest;
