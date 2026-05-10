import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MessageCircle, Calendar, DollarSign, RotateCcw, ArrowLeft } from 'lucide-react';

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
            <p className="mb-3">We offer four policy types:</p>
            <ul className="space-y-2 list-none">
              <li className="flex gap-2">
                <span className="font-semibold text-[#1E6A6A] flex-shrink-0">Flexible —</span>
                <span>Full refund if cancelled 24–48 hours before check-in.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#1E6A6A] flex-shrink-0">Moderate —</span>
                <span>Full refund up to 5–7 days before arrival.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#1E6A6A] flex-shrink-0">Strict —</span>
                <span>Refund only if cancelled 30+ days before arrival.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#1E6A6A] flex-shrink-0">Custom —</span>
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

const FAQItem = ({ q, a, isOpen, onToggle, testid }) => (
  <div className="border-b border-[#E5E5E5] last:border-b-0" data-testid={testid}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 py-4 md:py-5 text-left hover:text-[#1E6A6A] transition-colors group"
      aria-expanded={isOpen}
    >
      <span className="text-sm md:text-base font-semibold text-gray-900 group-hover:text-[#1E6A6A] transition-colors">
        {q}
      </span>
      <ChevronDown
        size={18}
        className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-[#1E6A6A]' : ''}`}
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

const FAQ = () => {
  const navigate = useNavigate();
  // Default first question of first section open so the page never
  // looks like a wall of cold accordions.
  const [openKey, setOpenKey] = useState('booking-0');

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  return (
    <div className="min-h-screen bg-[#fafafa] pt-24 pb-20 px-4" data-testid="faq-page">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#1E6A6A] mb-4 transition-colors"
          data-testid="faq-back"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <header className="mb-10">
          <p className="text-xs font-semibold text-[#D4AF37] uppercase tracking-[0.2em] mb-2">
            Help center
          </p>
          <h1
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
            style={{ fontFamily: 'Playfair Display' }}
          >
            Frequently asked questions
          </h1>
          <p className="text-base text-gray-600 leading-relaxed max-w-2xl">
            Everything you need to know about booking, fees, and cancellations.
            Still have questions? Reach out and we'll get back to you within a
            few hours.
          </p>
        </header>

        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden"
                data-testid={`faq-section-${section.id}`}
              >
                <div className="flex items-center gap-3 px-5 md:px-7 py-4 border-b border-[#f0ece4] bg-gradient-to-r from-[#fffaf0] to-white">
                  <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Icon size={17} />
                  </div>
                  <h2
                    className="text-lg md:text-xl font-bold text-gray-900"
                    style={{ fontFamily: 'Playfair Display' }}
                  >
                    {section.title}
                  </h2>
                </div>
                <div className="px-5 md:px-7">
                  {section.items.map((item, idx) => {
                    const key = `${section.id}-${idx}`;
                    return (
                      <FAQItem
                        key={key}
                        q={item.q}
                        a={item.a}
                        isOpen={openKey === key}
                        onToggle={() => toggle(key)}
                        testid={`faq-item-${key}`}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div
          className="mt-12 rounded-2xl bg-gradient-to-br from-[#1E6A6A] to-[#155454] text-white p-6 md:p-8"
          data-testid="faq-contact-cta"
        >
          <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
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
