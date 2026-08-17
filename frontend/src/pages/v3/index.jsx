/**
 * /v3/* - the unpinned rebrand proposal, applied across the marketing
 * surface so it can be judged as one direction rather than page by page.
 *
 * Every page here is LOOK-ONLY. Nothing is wired to the API, nothing
 * writes, and no route below is linked from the real navigation. The real
 * pages are untouched.
 *
 * SAMPLE CONTENT NOTICE: the listings, providers and requests below are
 * illustrative, written to exercise the layout. They are not real records
 * and must never be shown anywhere a visitor could read them as real.
 * Places are real neighbourhoods and prices are deliberately uneven,
 * because the skill bans fake-perfect numbers and generic placeholder
 * names, and because round numbers make a layout lie about how it will
 * hold up against actual data.
 *
 * Scope note: the skill states it covers "landing pages, portfolios, and
 * redesigns. Not dashboards, not data tables, not multi-step product UI",
 * so the dashboard, chat, booking, contract-signing and admin screens are
 * deliberately absent. Applying it there would produce something
 * confident and wrong.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SITE_ASSETS from '../../lib/siteAssets';
import {
  V3Page, V3Hero, V3Facts, V3List, V3Band, V3CTA, V3Cards,
} from '../../components/v3/kit';

const A = SITE_ASSETS;

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */
export const V3Home = () => {
  const nav = useNavigate();
  return (
    <V3Page testid="v3-home">
      <V3Hero
        eyebrow="Rentals and local services, Israel"
        title={<>Find your place.<br />Hire the pros.</>}
        body="One place for both, free for renters and owners. No service fees on either side."
        primary={{ label: 'Search rentals', onClick: () => nav('/v3/stays') }}
        secondary={{ label: 'Browse services', onClick: () => nav('/v3/services') }}
        media={
          <video
            src={A['clip0-aerial']}
            poster={A['scene1-aerial']}
            autoPlay muted loop playsInline
            aria-label="Aerial view of the Tel Aviv coastline at golden hour"
          />
        }
      />
      <V3Facts
        items={[
          ['0%', 'No service fees', 'Neither renters nor owners pay us a cut.'],
          ['2', 'Languages', 'Every listing and message, both directions.'],
          ['4 min', 'To sign', 'Contracts are agreed and signed on screen.'],
        ]}
      />
      <V3List
        title="Two sides of the same street."
        items={[
          ['Rentals', 'Long term, short term and vacation. Direct from the owner, with no agent in between.'],
          ['Local services', 'Movers, cleaners, handymen, tour guides. People who work in your area, not a national call centre.'],
          ['The Requests board', 'Post what you are looking for and let owners and tradespeople come to you.'],
          ['Chat that translates', 'Write in Hebrew, they read English. Nobody swaps phone numbers to get started.'],
          ['Contracts on screen', 'Send it, both sides sign, and the copy stays with both of you.'],
          ['Free to list', 'No listing fee, no subscription, no commission on what you agree.'],
        ]}
      />
      <V3Band>People find a home here without paying anyone a finder's fee.</V3Band>
      <section className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 80 }}>
        <h2 style={{ fontSize: 'clamp(28px,3.4vw,44px)', marginBottom: 36 }}>Places people are moving to</h2>
        <V3Cards
          items={[
            { img: A['scene3-interior-reveal'], alt: 'Bright apartment interior with sea view', title: 'Two rooms off Ben Yehuda', meta: 'Tel Aviv, 2 rooms, furnished', price: '₪6,400', per: 'a month' },
            { img: A['scene10-kotel-interior-v2'], alt: 'Stone-walled apartment interior in Jerusalem', title: 'Stone flat in Nachlaot', meta: 'Jerusalem, 3 rooms, long term', price: '₪7,850', per: 'a month' },
            { img: A['scene2-villa-approach'], alt: 'Beachfront villa in warm stone', title: 'Villa near the promenade', meta: 'Netanya, sleeps 6, vacation', price: '₪1,180', per: 'a night' },
          ]}
        />
      </section>
      <V3CTA
        title="Start with what you need."
        body="Searching is free and always will be."
        cta={{ label: 'Search rentals', onClick: () => nav('/v3/stays') }}
      />
    </V3Page>
  );
};

/* ------------------------------------------------------------------ */
/* Stays                                                               */
/* ------------------------------------------------------------------ */
export const V3Stays = () => {
  const nav = useNavigate();
  return (
    <V3Page testid="v3-stays">
      <V3Hero
        eyebrow="Rentals"
        title="Find your stay."
        body="Long term, short term and vacation rentals, direct from owners. Zero service fees."
        primary={{ label: 'Search rentals', onClick: () => {} }}
        media={<img src={A['scene1-aerial']} alt="Aerial view of the Tel Aviv coastline" />}
      />

      <section className="v3-wrap" style={{ marginTop: -34, position: 'relative', zIndex: 2 }}>
        <div className="v3-search">
          <div><label>Where</label><div className="val">Anywhere in Israel</div></div>
          <div><label>Stay type</label><div className="val">Long, short or vacation</div></div>
          <div><label>When</label><div className="val">Add dates</div></div>
          <button type="button">Search</button>
        </div>
      </section>

      <section className="v3-wrap" style={{ paddingTop: 64, paddingBottom: 24 }}>
        <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', marginBottom: 30 }}>Stays in Jerusalem</h2>
        <V3Cards
          items={[
            { img: A['scene10-kotel-interior-v2'], alt: 'Stone-walled apartment interior', title: 'Stone flat in Nachlaot', meta: '3 rooms, second floor, furnished', price: '₪7,850', per: 'a month' },
            { img: A['scene3-interior-reveal'], alt: 'Bright open-plan living room', title: 'Quiet two-bed, Ramat Eshkol', meta: '2 rooms, lift, long term', price: '₪6,200', per: 'a month' },
            { img: A['scene9-kotel-exterior-v2'], alt: 'Jerusalem stone exterior at dusk', title: 'Garden flat, Baka', meta: '4 rooms, private entrance', price: '₪9,300', per: 'a month' },
          ]}
        />
      </section>

      <section className="v3-wrap" style={{ paddingTop: 40, paddingBottom: 76 }}>
        <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', marginBottom: 30 }}>By the sea</h2>
        <V3Cards
          items={[
            { img: A['scene2-villa-approach'], alt: 'Beachfront villa in warm stone', title: 'Villa near the promenade', meta: 'Netanya, sleeps 6', price: '₪1,180', per: 'a night' },
            { img: A['scene4-guest-phone'], alt: 'Guest relaxing in a bright apartment', title: 'Studio off the boardwalk', meta: 'Bat Yam, sleeps 2', price: '₪410', per: 'a night' },
            { img: A['scene1-aerial'], alt: 'Coastline at golden hour', title: 'Sea-view two-bed', meta: 'Herzliya, sleeps 4', price: '₪760', per: 'a night' },
          ]}
        />
      </section>

      <V3CTA
        title="Not seeing it? Say what you are looking for."
        body="Owners answer requests directly on the board."
        cta={{ label: 'Post a request', onClick: () => nav('/v3/requests') }}
      />
    </V3Page>
  );
};

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */
export const V3Services = () => {
  const nav = useNavigate();
  return (
    <V3Page testid="v3-services">
      <V3Hero
        eyebrow="Local services"
        title="Hire someone who is already nearby."
        body="Movers, cleaners, handymen, tour guides. You message them directly and agree the price."
        primary={{ label: 'Browse services', onClick: () => {} }}
        secondary={{ label: 'Offer your services', onClick: () => nav('/v3/why-list') }}
        media={<img src={A['scene7-ac-pro']} alt="An air-conditioning technician at work" />}
      />

      <section className="v3-wrap" style={{ marginTop: -34, position: 'relative', zIndex: 2 }}>
        <div className="v3-search">
          <div><label>What</label><div className="val">Any service</div></div>
          <div><label>Where</label><div className="val">Anywhere in Israel</div></div>
          <div><label>When</label><div className="val">Any date</div></div>
          <button type="button">Search</button>
        </div>
      </section>

      <V3List
        title="What people book most."
        items={[
          ['Moving and delivery', 'Two movers and a van, or a single item across town. Quoted before they arrive.'],
          ['Cleaning', 'One-off deep cleans, end-of-lease, or a regular slot each week.'],
          ['Handyman and repairs', 'Air conditioning, plumbing, electrics, flat-pack, the shelf that has waited a year.'],
          ['Tour guides', 'Licensed guides who work in English, Hebrew, French and Russian.'],
          ['Photography', 'Listing photos that make a flat rent faster, and family shoots.'],
          ['Tech and setup', 'Internet, TV, smart-home kit, and getting a new place online on day one.'],
        ]}
      />

      <section className="v3-wrap" style={{ paddingBottom: 76 }}>
        <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', marginBottom: 30 }}>Featured near you</h2>
        <V3Cards
          items={[
            { img: A['scene7-ac-pro'], alt: 'Technician servicing an air conditioner', title: 'Air conditioning service', meta: 'Jerusalem and surrounds', price: '₪280', per: 'call-out' },
            { img: A['scene6-contract-laptop'], alt: 'Laptop on a desk at dusk', title: 'Listing photography', meta: 'Tel Aviv, same-week slots', price: '₪640', per: 'a shoot' },
            { img: A['scene8-requests-man'], alt: 'Person arranging a move at home', title: 'Two movers and a van', meta: 'Central district', price: '₪1,150', per: 'half day' },
          ]}
        />
      </section>

      <V3CTA
        title="Tell them what you need doing."
        body="Post it once and let the right people answer."
        cta={{ label: 'Post a request', onClick: () => nav('/v3/requests') }}
      />
    </V3Page>
  );
};

/* ------------------------------------------------------------------ */
/* Requests board                                                      */
/* ------------------------------------------------------------------ */
const REQUESTS = [
  ['Rental', '3 rooms wanted in Ramat Eshkol', 'Jerusalem · from September · up to ₪8,000 · 3+ rooms', 'Rivka L.'],
  ['Service', 'Mover needed on the 14th', 'Jerusalem · two rooms, third floor, no lift · up to ₪1,200', 'Daniel A.'],
  ['Rental', 'Quiet one-bed near the beach', 'Bat Yam · long term · up to ₪4,600', 'Yosef M.'],
  ['Service', 'Weekly cleaner, Tuesday mornings', 'Modiin · ongoing · ₪180 a visit', 'Tamar S.'],
  ['Rental', 'Furnished flat for a six-month stay', 'Haifa · from October · up to ₪5,400', 'Noa B.'],
];

export const V3Requests = () => {
  const nav = useNavigate();
  return (
    <V3Page testid="v3-requests">
      <V3Hero
        eyebrow="The Requests board"
        title="Tell owners what you are looking for."
        body="Post once and let owners and tradespeople come to you, instead of chasing a hundred listings."
        primary={{ label: 'Post a request', onClick: () => nav('/join') }}
        secondary={{ label: 'See the board', onClick: () => {} }}
        media={<img src={A['scene8-requests-man']} alt="Someone at home writing a request on a phone" />}
      />

      <section className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20, marginBottom: 30 }}>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)' }}>Open right now</h2>
          <div className="v3-tabs">
            <button className="v3-tab" aria-selected="true">All</button>
            <button className="v3-tab" aria-selected="false">Rentals</button>
            <button className="v3-tab" aria-selected="false">Services</button>
          </div>
        </div>

        <div className="v3-req">
          {REQUESTS.map(([kind, title, meta, who]) => (
            <div className="v3-req-row" key={title}>
              <span className={`v3-tag${kind === 'Service' ? ' v3-tag-alt' : ''}`}>{kind}</span>
              <div>
                <h3>{title}</h3>
                <div className="meta">{meta}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{who}</div>
                <div className="meta" style={{ fontSize: 13 }}>Verified · member since 2026</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <V3Band>Nobody's phone number changes hands. Replies happen in chat.</V3Band>

      <V3CTA
        title="Say what you need."
        body="It takes a minute and costs nothing."
        cta={{ label: 'Post a request', onClick: () => nav('/join') }}
      />
    </V3Page>
  );
};

/* ------------------------------------------------------------------ */
/* Why list (service providers)                                        */
/* ------------------------------------------------------------------ */
export const V3WhyList = () => {
  const nav = useNavigate();
  return (
    <V3Page testid="v3-why-list">
      <V3Hero
        eyebrow="For tradespeople"
        title={<>Get found by people<br />who already need you.</>}
        body="List what you do, free. Customers message you directly and you agree the price yourselves."
        primary={{ label: 'List your services free', onClick: () => nav('/join') }}
        media={<img src={A['scene7-ac-pro']} alt="A tradesperson at work" />}
      />
      <V3Facts
        items={[
          ['₪0', 'Free to list', 'No subscription, no lead fees.'],
          ['0%', 'No commission', 'What you quote is what you keep.'],
          ['24h', 'To go live', 'Most listings are up the same day.'],
        ]}
      />
      <V3List
        title="What you get."
        items={[
          ['Free to list', 'No subscription and no charge per lead. The whole site is free while we grow.'],
          ['Direct enquiries', 'Customers reach you in the app or on WhatsApp. Nobody sits in between taking a cut.'],
          ['Work in your language', 'Your listing is read in English or Hebrew, and chat translates both ways.'],
          ['Requests come to you', 'People post the jobs they need doing. If it matches your category, you hear about it.'],
          ['Your own page', 'Photos of past work, the areas you cover and the hours you actually work.'],
          ['No lock-in', 'Pause or remove your listing whenever the diary is full.'],
        ]}
      />
      <V3Band>The job you would have missed is on the board right now.</V3Band>
      <V3CTA
        title="Put your trade in front of them."
        body="Listing takes a few minutes and costs nothing."
        cta={{ label: 'List your services free', onClick: () => nav('/join') }}
      />
    </V3Page>
  );
};

/* ------------------------------------------------------------------ */
/* Join                                                                */
/* ------------------------------------------------------------------ */
const ROLES = [
  ['Traveler', 'Book stays and hire local services for your trip.', 'Free to browse, no booking fees'],
  ['Host', 'List your apartment or vacation rental.', 'Free to list, no commission'],
  ['Service provider', 'Cleaner, mover, guide, or any local trade.', 'Free to list, no lead fees'],
];

export const V3Join = () => {
  const nav = useNavigate();
  const [picked, setPicked] = useState('Traveler');
  return (
    <V3Page testid="v3-join">
      <section className="v3-hero" style={{ paddingBottom: 72 }}>
        <div className="v3-wrap" style={{ paddingTop: 88 }}>
          <div className="v3-eyebrow">Join free</div>
          <h1 style={{ fontSize: 'clamp(36px,4.4vw,60px)', margin: '18px 0 14px', maxWidth: '18ch' }}>
            Rent a home. List a place. Offer your trade.
          </h1>
          <p style={{ color: 'rgba(231,233,227,.78)', maxWidth: '52ch', marginBottom: 40 }}>
            One account covers all three. You can add another role later from your settings.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
            {ROLES.map(([name, body, note]) => {
              const on = picked === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setPicked(name)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: '28px 26px',
                    background: on ? 'var(--v3-bone)' : 'transparent',
                    color: on ? 'var(--v3-ink)' : 'var(--v3-bone)',
                    border: '1px solid rgba(231,233,227,.35)',
                    borderRight: 'none',
                    ...(name === ROLES[2][0] ? { borderRight: '1px solid rgba(231,233,227,.35)' } : {}),
                  }}
                >
                  <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 14, opacity: .82, marginBottom: 14 }}>{body}</div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.14em', color: on ? 'var(--v3-amber)' : 'rgba(231,233,227,.6)' }}>
                    {note}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="v3-btn" onClick={() => nav('/join')}>
              Continue as {picked.toLowerCase()} <ArrowRight size={16} />
            </button>
            <button className="v3-btn v3-btn-ghost" onClick={() => nav('/auth/login')}>
              I already have an account
            </button>
          </div>
        </div>
      </section>
      <V3Facts
        items={[
          ['0%', 'No fees, any side', 'Renters, owners and tradespeople all free.'],
          ['2', 'Languages', 'Everything works in English and Hebrew.'],
          ['1', 'Account', 'Add another role whenever you need it.'],
        ]}
      />
      <div style={{ height: 60 }} />
    </V3Page>
  );
};

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
const QA = [
  ['Is it really free?', 'Yes, for everyone, in both directions. No listing fee, no booking fee, no commission on what you agree, and no subscription for tradespeople.'],
  ['How do I contact an owner?', 'Message them in the app, or on WhatsApp where they have chosen to show it. There is no agent in between and no finder\'s fee.'],
  ['Do I need Hebrew?', 'No. Listings are shown in the language you read, and chat messages translate both ways.'],
  ['How does signing a contract work?', 'The owner sends the agreement, both of you sign on screen, and the signed copy stays available to both parties and nobody else.'],
  ['What is the Requests board?', 'Instead of searching, you post what you are looking for. Owners and tradespeople whose listing matches will hear about it and can reply in chat.'],
  ['Who can see my phone number?', 'Nobody, unless you choose to share it in a conversation. Requests and listings never expose contact details.'],
];

export const V3Faq = () => {
  const nav = useNavigate();
  return (
    <V3Page testid="v3-faq">
      <section className="v3-hero" style={{ paddingBottom: 64 }}>
        <div className="v3-wrap" style={{ paddingTop: 88 }}>
          <div className="v3-eyebrow">Questions</div>
          <h1 style={{ fontSize: 'clamp(36px,4.6vw,64px)', margin: '18px 0 0', maxWidth: '16ch' }}>
            The things people ask first.
          </h1>
        </div>
      </section>
      <section className="v3-wrap" style={{ paddingTop: 64, paddingBottom: 80 }}>
        <div className="v3-list">
          {QA.map(([q, a], i) => (
            <div className="v3-row" key={q}>
              <div className="idx">{String(i + 1).padStart(2, '0')}</div>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </section>
      <V3CTA
        title="Still stuck?"
        body="Message us and a person answers."
        cta={{ label: 'Get in touch', onClick: () => nav('/faq') }}
      />
    </V3Page>
  );
};
