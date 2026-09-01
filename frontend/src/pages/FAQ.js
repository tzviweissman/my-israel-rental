import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, MessageCircle, Calendar, DollarSign, RotateCcw, ArrowLeft, Search, X } from 'lucide-react';
import PageMeta from '../components/PageMeta';

const SECTIONS = [
  {
    id: 'booking',
    title: 'Booking & Reservations',
    icon: Calendar,
    items: [
      {
        q: 'How do I make a booking?',
        a: 'Browse available properties, select your dates and number of guests, then click "Reserve Now." Instant-booking properties confirm immediately; others may require host approval.',
      },
      {
        q: 'Can I book for same-day or last-minute stays?',
        a: 'Yes, many properties allow same-day bookings. Check the calendar for real-time availability.',
      },
      {
        q: 'Is my booking confirmed immediately?',
        a: 'Instant-book listings are confirmed right away. For other listings, you\'ll receive confirmation within a few hours after the host approves.',
      },
      {
        q: 'How many guests can I bring?',
        a: 'Some vacation properties have a maximum guest limit listed on the page. Extra guests may incur additional fees.',
      },
    ],
  },
  {
    id: 'fees',
    title: 'Fees',
    icon: DollarSign,
    items: [
      {
        q: 'Are there any website fees?',
        a: 'No. The website doesn\'t take any booking fees.',
      },
      {
        q: 'Are there any hidden fees?',
        a: 'No. All fees are displayed transparently before you confirm your booking or are written in the rental contract.',
      },
    ],
  },
  {
    id: 'cancellations',
    title: 'Cancellations & Refunds',
    icon: RotateCcw,
    items: [
      {
        q: 'What is your cancellation policy?',
        a: (
          <>
            <p className="mb-3">Policies are chosen by the lister. Common options include:</p>
            <ul className="space-y-2 list-none">
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--brand-primary)] flex-shrink-0">Flexible —</span>
                <span>Full refund if cancelled 24–48 hours before check-in.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--brand-primary)] flex-shrink-0">Moderate —</span>
                <span>Full refund up to 5–7 days before arrival.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--brand-primary)] flex-shrink-0">Strict —</span>
                <span>Refund only if cancelled 30+ days before arrival.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--brand-primary)] flex-shrink-0">Custom —</span>
                <span>Chosen by the lister.</span>
              </li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: 'support',
    title: 'Hosts & Support',
    icon: MessageCircle,
    items: [
      {
        q: 'How do I contact the host?',
        a: 'Use the messaging system inside your booking. Hosts usually reply within a few hours.',
      },
    ],
  },
];

const FAQItem = ({ q, a, isOpen, onToggle, testid, highlight }) => (
  <div className="border-b border-[#E5E5E5] last:border-b-0" data-testid={testid}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 py-4 md:py-5 text-left hover:text-[var(--brand-primary)] transition-colors group"
      aria-expanded={isOpen}
    >
      <span className="text-sm md:text-base font-semibold text-gray-900 group-hover:text-[var(--brand-primary)] transition-colors">
        {highlight ? highlightText(q, highlight) : q}
      </span>
      <ChevronDown
        size={18}
        className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-[var(--brand-primary)]' : ''}`}
      />
    </button>
    <div
      className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-5' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className="overflow-hidden">
        <div className="text-sm md:text-[15px] text-gray-600 leading-relaxed pr-6">
          {a}
        </div>
      </div>
    </div>
  </div>
);

// Pull plain searchable text out of an answer that may be a string or JSX.
const answerToText = (a) => {
  if (typeof a === 'string') return a;
  // Walk React children to extract any string content.
  const walk = (node) => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(walk).join(' ');
    if (node.props && node.props.children) return walk(node.props.children);
    return '';
  };
  return walk(a);
};

// Wrap occurrences of `query` in <mark> for visible match highlighting.
const highlightText = (text, query) => {
  if (!query) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${safe})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-[rgb(var(--gold-rgb)/<alpha-value>)]/30 text-gray-900 rounded px-0.5">{part}</mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

// Precomputed FAQPage JSON-LD payload from the SECTIONS module constant.
// Google (and Bing) parse this out of the DOM to render rich FAQ
// snippets. Kept at module scope so it's computed once at import time
// instead of on every FAQ render.
const FAQ_JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SECTIONS.flatMap((s) => s.items).map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      // `item.a` can be a plain string or JSX (see cancellation policy).
      // Flatten to searchable text so the schema stays valid JSON.
      text: answerToText(item.a),
    },
  })),
});

const FAQ = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Default first question of first section open so the page never
  // looks like a wall of cold accordions.
  const [openKey, setOpenKey] = useState('booking-0');
  const [query, setQuery] = useState('');

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  // Filter sections + items by query. When searching, every match is
  // pre-expanded so the user sees their answer immediately.
  const filteredSections = useMemo(() => {
    if (!isSearching) return SECTIONS;
    const q = trimmedQuery.toLowerCase();
    return SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) ||
            answerToText(item.a).toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [trimmedQuery, isSearching]);

  const totalMatches = filteredSections.reduce((n, s) => n + s.items.length, 0);

  // Build a Schema.org FAQPage payload from every Q&A on the page so
  // Google (and other engines) can surface rich FAQ snippets in search
  // results. Computed at module scope (see FAQ_JSON_LD constant).

  return (
    <div className="min-h-screen bg-[#fafafa] pt-[140px] sm:pt-[160px] md:pt-[220px] pb-20 px-4" data-testid="faq-page">
      <PageMeta
        title="FAQ — Renting in Israel made simple | MyIsraelRental"
        description="Answers about booking, payments, cancellations, deposits and contracts when renting in Israel. Learn how MyIsraelRental keeps it free for renters and owners."
        path="/faq"
      />
      {/* FAQPage structured data — Google reads this and can render rich
          "People Also Ask"-style expandable snippets on the SERP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: FAQ_JSON_LD }}
        data-testid="faq-jsonld"
      />
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[var(--brand-primary)] mb-4 transition-colors"
          data-testid="faq-back"
        >
          <ArrowLeft size={16} /> {t('common.back')}
        </button>

        <header className="mb-8">
          <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-[0.2em] mb-2">
            Help center
          </p>
          <h1
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Frequently asked questions
          </h1>
          <p className="text-base text-gray-600 leading-relaxed max-w-2xl">
            Everything you need to know about booking, fees, and cancellations.
            Still have questions? Reach out and we'll get back to you within a
            few hours.
          </p>
        </header>

        {/* Search bar */}
        <div className="relative mb-8" data-testid="faq-search-wrapper">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-[#E5E5E5] bg-white text-sm md:text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 focus:border-[var(--brand-primary)] transition-all shadow-sm"
            data-testid="faq-search-input"
          />
          {isSearching && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label={t('faqExtra.clearSearch')}
              data-testid="faq-search-clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {isSearching && (
          <p className="text-xs text-gray-500 mb-5 -mt-3" data-testid="faq-results-count">
            {totalMatches === 0
              ? 'No matches'
              : `${totalMatches} ${totalMatches === 1 ? 'match' : 'matches'} for "${trimmedQuery}"`}
          </p>
        )}

        {filteredSections.length === 0 ? (
          <div
            className="bg-white rounded-2xl border border-[#E5E5E5] p-10 text-center"
            data-testid="faq-no-results"
          >
            <p className="text-sm text-gray-700 font-medium mb-1">
              We couldn't find an answer for that.
            </p>
            <p className="text-xs text-gray-500 mb-5">
              Try different keywords, or message our team directly on WhatsApp.
            </p>
            <a
              href="https://wa.me/972553225141"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-[#1fb558] text-white transition-colors"
            >
              <MessageCircle size={14} /> Ask on WhatsApp
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.id}
                  className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden"
                  data-testid={`faq-section-${section.id}`}
                >
                  <div className="flex items-center gap-3 px-5 md:px-7 py-4 border-b border-[#f0ece4] bg-gradient-to-r from-[#fffaf0] to-white">
                    <div className="w-9 h-9 rounded-lg bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 text-[var(--gold)] flex items-center justify-center flex-shrink-0">
                      <Icon size={17} />
                    </div>
                    <h2
                      className="text-lg md:text-xl font-bold text-gray-900"
                      style={{ fontFamily: 'var(--font-head)' }}
                    >
                      {section.title}
                    </h2>
                  </div>
                  <div className="px-5 md:px-7">
                    {section.items.map((item, idx) => {
                      const key = `${section.id}-${idx}`;
                      // While searching, force every matching row open so the
                      // user can read the answer without an extra tap.
                      const isOpen = isSearching ? true : openKey === key;
                      return (
                        <FAQItem
                          key={key}
                          q={item.q}
                          a={item.a}
                          isOpen={isOpen}
                          onToggle={() => toggle(key)}
                          testid={`faq-item-${key}`}
                          highlight={isSearching ? trimmedQuery : ''}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div
          className="mt-12 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[#155454] text-white p-6 md:p-8"
          data-testid="faq-contact-cta"
        >
          <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-head)' }}>
            Still have questions?
          </h3>
          <p className="text-sm text-white/80 mb-5 max-w-lg">
            Our team is happy to help. Send us a message on WhatsApp and we'll
            get back to you within a few hours.
          </p>
          <a
            href="https://wa.me/972553225141"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#25D366] hover:bg-[#1fb558] text-white transition-colors"
            data-testid="faq-whatsapp-cta"
          >
            <MessageCircle size={16} /> Chat on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
