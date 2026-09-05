/**
 * P7b: the brief. Six questions, mostly taps, before anyone types.
 *
 * THE FORM IS THE PROMPT ENGINEERING. An owner never writes a prompt;
 * they answer this, and this is what a model will later receive. It is
 * how a designer starts a job, and it is the difference between a vague
 * sentence and a specification.
 *
 * Building it in phase 2, with no model behind it, is not scaffolding.
 * The answers drive `briefToTheme` today - real dial positions, applied
 * live to the real preview - so the questions are tested against whether
 * they change anything before anybody is charged for an answer. A
 * question that changes nothing is a question that should not be asked,
 * and that is only findable by wiring it to something.
 *
 * FIVE RULES, all from P7b:
 *
 *   * Everything is skippable and every default is good. Someone who
 *     answers nothing still gets a page worth sending.
 *   * The preview updates as they answer. They watch the page assemble,
 *     which teaches what each choice does without a word of explanation.
 *   * Endowed progress. They have already given us a name, what they
 *     sell, where they work and some photos, so the count starts where it
 *     actually is rather than at zero. Counted, not assumed.
 *   * Answers are saved. Editing the brief never re-asks and never costs.
 *   * Question 6 is rendered from THEIR OWN CONTENT. Four small copies of
 *     their real page, not stock examples and not a mock-up built out of
 *     styled divs, which is the single most recognisable tell in
 *     AI-generated design.
 *
 * WHAT IS NOT ASKED, and each omission is a decision:
 *
 *   * No colour question. The palette is the accent picker, and asking
 *     here would be a colour picker by the back door.
 *   * No adjective list ("modern, playful, bold"). People tick those
 *     arbitrarily and the result then feels random, which reads as the
 *     tool being bad rather than the question being bad.
 *   * No "what is your brand personality". Flattering to answer, decides
 *     nothing downstream.
 *   * Nothing they would have to go and look up.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

import BusinessPage from '../../pages/BusinessPage';
import PreviewFrame from './PreviewFrame';
import {
  BRIEF, MAX_STRENGTHS, MAX_NOTE, PRESETS, PRESET_NAMES, briefProgress,
} from '../../utils/pageComposition';

/* English fallbacks. Every string has a real key in both locale files;
   these are what `t` falls back to if one is ever missing, so the worst
   case is English rather than a blank control. */
const QUESTIONS = [
  {
    key: 'showing',
    q: 'What are you showing people?',
    a: {
      services: 'A few services',
      catalogue: 'A catalogue of products',
      'one-thing': 'One main thing',
      place: 'A place people visit',
      properties: 'Properties',
    },
  },
  {
    key: 'action',
    q: 'What should someone do when they land here?',
    a: {
      message: 'Message me',
      book: 'Book a time',
      visit: 'Come to the shop',
      order: 'Order something',
      understand: 'Just understand what I do',
    },
  },
  {
    key: 'audience',
    q: 'Who is it mostly for?',
    a: {
      locals: 'Locals nearby',
      olim: 'English speakers and olim',
      tourists: 'Tourists',
      businesses: 'Other businesses',
      everyone: 'Everyone',
    },
  },
  {
    // Phrased without judgement, because nobody ticks "cheap".
    key: 'pricing',
    q: 'Where do your prices sit?',
    a: {
      premium: 'Premium, and worth it',
      fair: 'Fair, middle of the road',
      value: 'Great value, keenly priced',
      quote: 'Depends on the job, I quote',
    },
  },
];

const STRENGTHS = {
  quality: 'The quality of the work',
  speed: 'How fast I am',
  price: 'The price',
  experience: 'Years of experience',
  kosher: 'Kosher certification',
  english: 'I speak English',
  family: 'Family business',
  licensed: 'Licensed and insured',
};

const PRESET_LABELS = {
  quiet: 'Understated',
  warm: 'Warm',
  bold: 'Bold',
  plain: 'Straightforward',
};

/** A chip. One shape for every answer in the form, so nothing reads as
 *  more important than anything else by accident. */
const Choice = ({ on, children, testid, ...rest }) => (
  <button
    type="button"
    className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold border text-start"
    style={{
      borderColor: on ? 'var(--brand-primary)' : 'var(--brand-border)',
      background: on ? 'rgb(var(--brand-primary-rgb) / 0.10)' : 'var(--surface)',
      color: on ? 'var(--brand-primary-deep, var(--brand-primary))' : 'var(--ink)',
    }}
    data-testid={testid}
    {...rest}
  >
    {children}
  </button>
);

export default function PageBriefForm({
  business, brief, onChange, theme, onPickPreset, previewBusiness,
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(true);
  const b = brief || {};
  const progress = briefProgress(business, b);
  const dir = i18n.dir ? i18n.dir() : 'ltr';

  const set = (key, value) => onChange({ ...b, [key]: b[key] === value ? null : value });

  const toggleStrength = (key) => {
    const have = b.strengths || [];
    if (have.includes(key)) {
      onChange({ ...b, strengths: have.filter((x) => x !== key) });
      return;
    }
    // Two, and the cap is the point: a business that leads with eight
    // things leads with none. Oldest out, so the last tap always lands
    // rather than silently doing nothing.
    onChange({ ...b, strengths: [...have, key].slice(-MAX_STRENGTHS) });
  };

  const activePreset = PRESET_NAMES.find(
    (name) => Object.entries(PRESETS[name]).every(([k, v]) => (theme || {})[k] === v),
  ) || null;

  return (
    <section
      className="pt-5 border-t"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid="page-design-brief"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-start"
        aria-expanded={open}
        data-testid="page-design-brief-toggle"
      >
        <span>
          <span className="text-sm font-bold block" style={{ color: 'var(--ink)' }}>
            {t('pageDesign.brief', 'A few questions')}
          </span>
          <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {/* Endowed progress, and the number is real: it counts what
                this business has actually already told us. */}
            {t('pageDesign.briefProgress', '{{done}} of {{total}} answered', {
              done: progress.done, total: progress.total,
            })}
          </span>
        </span>
        <ChevronDown
          size={16}
          style={{ color: 'var(--brand-muted)', transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('pageDesign.briefHint', 'Skip anything you like. Your page already works without these, and answering just moves the settings below for you.')}
          </p>

          {QUESTIONS.map((question, qi) => (
            <div key={question.key}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
                {qi + 1}. {t(`pageDesign.q_${question.key}`, question.q)}
              </p>
              {/* Wrapped, not stacked. Five full-width rows per question
                  turned a 90-second form into a 1,000px scroll, and a form
                  that looks long is a form people leave. Chips size to
                  their own text, so the short answers share a line and only
                  the long ones take one. */}
              <div className="flex flex-wrap gap-1.5" data-testid={`page-design-q-${question.key}`}>
                {BRIEF[question.key].map((value) => (
                  <Choice
                    key={value}
                    on={b[question.key] === value}
                    onClick={() => set(question.key, value)}
                    aria-pressed={b[question.key] === value}
                    testid={`page-design-q-${question.key}-${value}`}
                  >
                    {t(`pageDesign.a_${question.key}_${value}`, question.a[value])}
                  </Choice>
                ))}
              </div>
            </div>
          ))}

          {/* 5. Up to two. */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
              5. {t('pageDesign.q_strengths', 'What should people know first about you?')}
              <span className="font-normal" style={{ color: 'var(--brand-muted)' }}>
                {' '}
                {t('pageDesign.q_strengthsCap', '(up to two)')}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5" data-testid="page-design-q-strengths">
              {BRIEF.strengths.map((key) => (
                <Choice
                  key={key}
                  on={(b.strengths || []).includes(key)}
                  onClick={() => toggleStrength(key)}
                  aria-pressed={(b.strengths || []).includes(key)}
                  testid={`page-design-q-strengths-${key}`}
                >
                  {t(`pageDesign.strength_${key}`, STRENGTHS[key])}
                </Choice>
              ))}
            </div>
          </div>

          {/* 6. The recognition question. Four copies of THEIR page. */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
              6. {t('pageDesign.q_look', 'Which of these feels closest?')}
            </p>
            <div className="grid grid-cols-2 gap-2" data-testid="page-design-q-look">
              {PRESET_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onPickPreset(name)}
                  aria-pressed={activePreset === name}
                  className="rounded-lg border overflow-hidden text-start"
                  style={{
                    borderColor: activePreset === name ? 'var(--brand-primary)' : 'var(--brand-border)',
                    borderWidth: activePreset === name ? 2 : 1,
                  }}
                  data-testid={`page-design-look-${name}`}
                >
                  {/* Their own page, at that setting. Not a stock example
                      and not a drawing of one: a picture of a page that is
                      not theirs teaches them nothing about the choice, and
                      a fake built out of styled divs is the most
                      recognisable tell there is. */}
                  {/* 240px, and the number is the whole question working
                      or not. At 120 all four thumbnails showed only the
                      cover and the name, which every preset draws almost
                      identically - four pictures of the same thing, and a
                      recognition question where nothing is recognisable is
                      worse than not asking. 240 reaches the first row of
                      cards, where spacing, photo size and price actually
                      differ. */}
                  <span
                    className="block pointer-events-none"
                    style={{ height: 240, overflow: 'hidden' }}
                    aria-hidden="true"
                  >
                    {previewBusiness && (
                      <PreviewFrame
                        width={390}
                        height={620}
                        dir={dir}
                        lang={i18n.language}
                        title={t(`pageDesign.preset_${name}`, PRESET_LABELS[name])}
                      >
                        <BusinessPage
                          business={{
                            ...previewBusiness,
                            // Four live pages is four React trees. Trimmed
                            // to what a 120px-tall thumbnail can actually
                            // show, so the cost is a thumbnail's worth.
                            listings: (previewBusiness.listings || []).slice(0, 4),
                            page: {
                              ...(previewBusiness.page || {}),
                              theme: { ...(theme || {}), ...PRESETS[name] },
                            },
                          }}
                          preview
                        />
                      </PreviewFrame>
                    )}
                  </span>
                  <span className="block px-2 py-1.5 text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {t(`pageDesign.preset_${name}`, PRESET_LABELS[name])}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* The only place they type, and it is optional and last. The
              placeholder is a real example rather than instructions,
              because an instruction in a placeholder is a form asking to
              be taught how to fill itself in. */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
              {t('pageDesign.q_note', 'Anything else you want people to know?')}
              <span className="font-normal" style={{ color: 'var(--brand-muted)' }}>
                {' '}
                {t('pageDesign.optional', '(optional)')}
              </span>
            </p>
            <textarea
              value={b.note || ''}
              onChange={(e) => onChange({ ...b, note: e.target.value.slice(0, MAX_NOTE) })}
              rows={3}
              maxLength={MAX_NOTE}
              placeholder={t(
                'pageDesign.notePlaceholder',
                'We have been on Emek Refaim since 1998 and everything is baked the same morning.',
              )}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="page-design-note"
            />
            <p className="text-[11px] mt-0.5 text-end" style={{ color: 'var(--brand-muted)' }}>
              {(b.note || '').length}/{MAX_NOTE}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
