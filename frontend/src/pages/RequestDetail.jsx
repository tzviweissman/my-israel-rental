/**
 * RequestDetail — /requests/:id.
 *
 * Public to read. The one action is "Message seeker", which POSTs to
 * /contact and follows the chat URL the server returns — the client never
 * constructs it, because the server is what decides whether this viewer
 * is allowed to contact at all and what counts as a contact.
 *
 * There is deliberately no seeker name, photo or contact detail on this
 * page. The API doesn't return any; identity is something the seeker
 * reveals in chat, not something the board publishes.
 */
import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import formatDate from '../utils/formatDate';
import {
  Home, Wrench, MapPin, Coins, BedDouble, CalendarDays, Clock,
  MessageCircle, Loader2, ArrowLeft, Flag, CheckCircle2, RefreshCw, ExternalLink,
  Tag, ShieldAlert, Package,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import ItemAttributes from '../components/requests/ItemAttributes';

const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso) - new Date();
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86400000));
};

const Row = ({ Icon, label, value }) => (
  value ? (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
      <Icon size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
      <span style={{ color: 'var(--brand-muted)' }}>{label}</span>
      <b>{value}</b>
    </div>
  ) : null
);

const RequestDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  // Which photo is large. Null means "the first one" rather than being
  // seeded from `request`, which is not loaded yet at this point.
  const [chosenPhoto, setChosenPhoto] = useState(null);

  // Both sides of the board render through this page, and nearly every
  // label below means the opposite thing on each. Named once so a new row
  // cannot quietly inherit the seeker's wording.
  const isOffer = request?.post_kind === 'have';

  const load = () => {
    setLoading(true);
    axios.get(`${API}/marketplace/requests/${id}`)
      .then((r) => { setRequest(r.data); setNotFound(false); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const isMine = user && request && request.poster_user_id === user.id;

  const contact = async () => {
    if (!user) {
      navigate(`/join?redirect=${encodeURIComponent(`/requests/${id}`)}`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/requests/${id}/contact`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Follow the server's URL rather than building one — it owns the
      // rule about who may contact whom.
      navigate(data.chat_url);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.contactFailed', 'Could not open the chat'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (path, successMsg, body = {}) => {
    setBusy(true);
    try {
      await axios.post(`${API}/marketplace/requests/${id}/${path}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.actionFailed', 'That did not work'));
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    const reason = window.prompt(isOffer
      ? t('requests.reportPromptOffer', 'What is wrong with this post?')
      : t('requests.reportPrompt', 'What is wrong with this request?'));
    if (!reason || reason.trim().length < 3) return;
    try {
      await axios.post(`${API}/marketplace/requests/${id}/report`, { reason: reason.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(t('requests.reported', 'Thanks — we will take a look.'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.actionFailed', 'That did not work'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: 'var(--brand-primary)' }} />
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div
        className="min-h-screen px-4"
        style={{ background: 'var(--bg)', paddingTop: 'calc(var(--nav-h, 68px) + 80px)' }}
        data-testid="request-not-found"
      >
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
            {isOffer
              ? t('requests.goneTitleOffer', 'This post is no longer available')
              : t('requests.goneTitle', 'This request is no longer available')}
          </p>
          <p className="text-sm mt-2 mb-6" style={{ color: 'var(--brand-muted)' }}>
            {t('requests.goneBody', 'It may have been found, withdrawn or removed.')}
          </p>
          <button type="button" onClick={() => navigate('/requests')} className="btn-blue-solid">
            {t('requests.backToBoard', 'Back to the board')}
          </button>
        </div>
      </div>
    );
  }

  const isRental = request.request_type === 'rental';
  const isItem = request.request_type === 'item';
  const isSold = request.item_status === 'sold';
  const photos = request.photos || [];
  const photo = chosenPhoto && photos.includes(chosenPhoto) ? chosenPhoto : photos[0];
  const expiresIn = daysUntil(request.expires_at);
  const budget = request.budget_amount
    ? `${request.budget_currency === 'USD' ? '$' : '₪'}${Number(request.budget_amount).toLocaleString()}`
    : t('requests.budgetOpenShort', 'Open to offers');

  // C3 — one value for both variants' date row. Flexible is stated rather
  // than left blank: a blank row makes a flexible seeker indistinguishable
  // from one who never answered, and an owner reads those very differently.
  // null falls through to the Row component's own empty handling.
  const rawDate = formatDate(
    isRental ? request.move_in_date : request.preferred_date);
  // Same rule as the board card: an offer's date is always the day the
  // place comes free, so it always reads "from" — regardless of date_mode,
  // which is a seeker's concept ("before"/deadline). A bare date on an
  // offer is ambiguous between "available then" and "gone by then".
  const dateValue = request.date_mode === 'flexible'
    ? t('requests.dateFlexible', "I'm flexible")
    : rawDate && isOffer
      ? t('requests.dateFromPrefix', 'from {{date}}', { date: rawDate })
      : rawDate && request.date_mode === 'before'
        ? t('requests.dateByPrefix', 'by {{date}}', { date: rawDate })
        : rawDate;

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="request-detail-page"
    >
      <PageMeta
        title={`${request.title} | MyIsraelRental`}
        description={(request.description || '').slice(0, 155)}
        path={`/requests/${id}`}
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate('/requests')}
          className="inline-flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: 'var(--brand-muted)' }}
          data-testid="request-detail-back"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('requests.backToBoard', 'Back to the board')}
        </button>

        <div className="bg-white rounded-2xl border p-6 sm:p-8" style={{ borderColor: 'var(--brand-border)' }}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`rc-badge ${request.post_kind === 'have' ? 'rc-badge-offer' : 'rc-badge-want'}`}>
              {request.post_kind === 'have'
                ? t('requests.badgeHave', 'Post')
                : t('requests.badgeWant', 'Request')}
            </span>
            {/* Three variants, not two. This read `isRental ? Rental :
                Service`, so an item was badged SERVICE with a wrench —
                the same two-way branch on a three-way question that the
                title placeholder had. */}
            <span className={`rc-badge ${isItem ? 'rc-badge-item' : isRental ? 'rc-badge-rental' : 'rc-badge-service'}`}>
              {isItem ? <Package size={11} aria-hidden="true" />
                : isRental ? <Home size={11} aria-hidden="true" />
                  : <Wrench size={11} aria-hidden="true" />}
              {isItem ? t('requests.item', 'Item')
                : isRental ? t('requests.rental', 'Rental')
                  : t('requests.service', 'Service')}
            </span>
            {isSold && (
              <span className="rc-badge rc-badge-sold" data-testid="request-detail-sold">
                {t('requests.soldBadge', 'Sold')}
              </span>
            )}
            {request.status !== 'open' && (
              <span className="rc-badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                {t(`requests.status_${request.status}`, request.status)}
              </span>
            )}
            {request.status === 'open' && expiresIn != null && (
              <span className="rc-status">
                <Clock size={12} aria-hidden="true" />
                {t('requests.expiresIn', 'expires in {{n}} days', { n: expiresIn })}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }} dir="auto">
            {request.title}
          </h1>

          {/* Above the facts, because on a classified ad the photo IS the
              first fact. One large, the rest as thumbnails that swap it —
              a grid of equal squares makes the reader choose where to
              look before they have seen anything. */}
          {isItem && photos.length > 0 && (
            <div className="mb-5" data-testid="request-photos">
              <img
                src={photo}
                alt={request.title}
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: 420, background: 'var(--bg)' }}
                data-testid="request-photo-main"
              />
              {photos.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                  {photos.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setChosenPhoto(url)}
                      className="shrink-0 rounded-lg overflow-hidden border-2 transition-colors"
                      style={{ borderColor: url === photo ? 'var(--brand-primary)' : 'transparent' }}
                      aria-label={t('requests.showPhoto', 'Show photo {{n}}', { n: i + 1 })}
                      data-testid={`request-photo-thumb-${i}`}
                    >
                      <img src={url} alt="" className="w-16 h-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2 mb-5">
            <Row Icon={MapPin} label={t('requests.fieldArea', 'Area')} value={request.area} />
            {/* A budget is what a seeker will spend. On an offer the
                same number is what they are asking for. */}
            <Row
              Icon={Coins}
              label={isOffer
                ? (isRental
                  ? t('requests.fieldAskingRent', 'Asking rent')
                  : t('requests.fieldPrice', 'Price'))
                : t('requests.fieldBudget', 'Budget')}
              value={budget}
            />
            {isRental && (
              <>
                <Row
                  Icon={BedDouble}
                  label={isOffer
                    ? t('requests.fieldBedroomsOffer', 'Bedrooms')
                    : t('requests.fieldBedrooms', 'Bedrooms (minimum)')}
                  value={request.bedrooms_min || null}
                />
                <Row
                  Icon={CalendarDays}
                  label={isOffer
                    ? t('requests.fieldAvailableFrom', 'Available from')
                    : t('requests.fieldMoveIn', 'Move-in date')}
                  value={dateValue}
                />
                <Row Icon={Clock} label={t('requests.fieldLease', 'Lease length (months)')} value={request.lease_months} />
              </>
            )}
            {isItem && (
              <>
                <Row
                  Icon={Tag}
                  label={t('requests.fieldCondition', 'Condition')}
                  value={request.condition
                    ? t(`requests.condition_${request.condition}`, request.condition.replace(/-/g, ' '))
                    : null}
                />
                <Row
                  Icon={MapPin}
                  label={t('requests.fieldPickup', 'Collection from')}
                  value={request.pickup_area}
                />
              </>
            )}
            {!isRental && !isItem && (
              <>
                <Row Icon={Wrench} label={t('requests.fieldCategory', 'Category')} value={(request.category || '').replace(/-/g, ' ')} />
                <Row Icon={CalendarDays} label={t('requests.fieldPreferredDate', 'Preferred date')} value={dateValue} />
              </>
            )}
          </div>

          {/* The full listing, when the poster has one here. Only ever an
              internal /property/{id} link - the id is checked server-side
              to belong to the poster, so this cannot point off-site. */}
          {request.listing_id && (
            <a
              href={`/property/${request.listing_id}`}
              className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold"
              style={{ color: 'var(--brand-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              data-testid="request-detail-listing-link"
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t('requests.viewListingFull', 'See the full listing — photos, price and availability')}
            </a>
          )}

          <p className="text-sm leading-relaxed whitespace-pre-line mb-6" style={{ color: 'var(--ink)' }}>
            {request.description}
          </p>

          {/* G3 — the item specifics. Below the description rather than in
              the rows above it: the rows are the five things every post
              has, and burying "does it fit through a door" among them
              would push price and collection point off the first screen
              on a phone. */}
          {isItem && (
            <ItemAttributes
              category={request.category}
              attributes={request.attributes}
              provenanceProvided={request.provenance_provided}
            />
          )}

          {/* N6 — on EVERY item, for BOTH sides. It sat in the buyer's
              branch first, which meant the seller never saw it: they are
              the one arranging to meet a stranger at their own address,
              so if either party needs the line more it is them.

              Phrased so it can never be read as a guarantee. There is no
              escrow, no buyer protection and nothing to fall back on —
              saying that plainly IS the protection, and implying
              otherwise would be a promise we cannot honour. */}
          {isItem && (
            <div
              className="flex items-start gap-2.5 rounded-xl p-3 mb-6"
              style={{ background: 'var(--bg)', border: '1px solid var(--brand-border)' }}
              data-testid="request-item-safety"
            >
              <ShieldAlert size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-muted)' }} />
              <p className="text-xs leading-snug" style={{ color: 'var(--brand-muted)' }}>
                {t('requests.itemSafety',
                  'Meet in a public place. Never transfer money before you have the item. MyIsraelRental never handles payment.')}
              </p>
            </div>
          )}

          {isMine ? (
            /* The seeker's own controls. contact_count is shown here and
               nowhere else — it is the one number that tells them their
               post is working. */
            <div className="border-t pt-5" style={{ borderColor: 'var(--brand-border)' }} data-testid="request-owner-actions">
              <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>
                {t('requests.contactCount', '{{n}} people have opened a chat about this', { n: request.contact_count || 0 })}
              </p>
              <div className="flex flex-wrap gap-2">
                {request.status !== 'found' && (
                  <button type="button" onClick={() => act('found', isOffer
                    ? t('requests.markedTaken', 'Marked as taken')
                    : t('requests.markedFound', 'Marked as found'))}
                          disabled={busy} className="btn-blue-solid inline-flex items-center gap-1.5 disabled:opacity-60"
                          data-testid="request-mark-found">
                    <CheckCircle2 size={15} />{isOffer
                      ? t('requests.markTaken', "It's taken")
                      : t('requests.markFound', "I found it")}
                  </button>
                )}
                {/* One tap, and reversible — a sale falls through, and a
                    board where "sold" is one-way teaches sellers not to
                    press it. The post STAYS: it leaves the default view
                    but a shared link still resolves, so a buyer who
                    arrives late reads "sold" instead of hitting a 404. */}
                {isItem && request.status !== 'found' && (
                  <button
                    type="button"
                    onClick={() => act(
                      'sold',
                      isSold
                        ? t('requests.availableToast', 'Back on sale.')
                        : t('requests.soldToast', 'Marked sold — the post stays up so buyers know.'),
                      { sold: !isSold },
                    )}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-full text-sm font-semibold border disabled:opacity-60 inline-flex items-center gap-1.5"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                    data-testid="request-mark-sold"
                  >
                    <Tag size={14} />
                    {isSold
                      ? t('requests.markAvailable', 'Put back on sale')
                      : t('requests.markSold', 'Mark as sold')}
                  </button>
                )}
                {request.status !== 'found' && (
                  <button type="button" onClick={() => act('renew', t('requests.renewed', 'Renewed for another 30 days'))}
                          disabled={busy} className="px-4 py-2.5 rounded-full text-sm font-semibold border disabled:opacity-60 inline-flex items-center gap-1.5"
                          style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                          data-testid="request-renew">
                    <RefreshCw size={14} />{t('requests.renew', 'Renew')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t pt-5" style={{ borderColor: 'var(--brand-border)' }}>
              <div className="flex flex-wrap items-center gap-3">
              <button
                type="button" onClick={contact} disabled={busy || request.status !== 'open'}
                className="btn-blue-solid inline-flex items-center gap-2 disabled:opacity-60"
                data-testid="request-contact-btn"
              >
                {busy ? <Loader2 className="animate-spin" size={15} /> : <MessageCircle size={15} />}
                {request.post_kind === 'have'
                  ? t('requests.messageOwner', 'Message owner')
                  : t('requests.messageSeeker', 'Message seeker')}
              </button>
            {/* Opt-in only, and through the tracked redirect so the number
                stays server-side and the click is counted. */}
            {request.whatsapp_available && (
              <a
                href={`${API}/marketplace/requests/${encodeURIComponent(id)}/contact-whatsapp`
                  + `?text=${encodeURIComponent(request.post_kind === 'have'
                    ? t('requests.waPrefillOffer', 'Hi! I saw your post on the MyIsraelRental marketplace.')
                    : t('requests.waPrefillRequest', 'Hi! I saw your request on the MyIsraelRental marketplace.'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp inline-flex items-center gap-2"
                data-testid="request-detail-whatsapp"
              >
                <MessageCircle size={15} aria-hidden="true" />
                {t('requests.messageWhatsapp', 'WhatsApp')}
              </a>
            )}
              <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('requests.chatOnlyNote', 'Chat happens on MyIsraelRental — no phone numbers are shared.')}
              </span>
              {user && (
                <button
                  type="button" onClick={report}
                  className="ms-auto text-xs font-semibold inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--brand-muted)' }}
                  data-testid="request-report-btn"
                >
                  <Flag size={12} />{t('requests.report', 'Report')}
                </button>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;
