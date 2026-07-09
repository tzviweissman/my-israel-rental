import React from 'react';

/**
 * WhatsAppButton — floating FAB in the bottom-right.
 *
 * Position uses `env(safe-area-inset-bottom)` so on iOS (notch / home
 * indicator) the button never sits under the gesture bar. The base
 * offset includes a `--bottom-nav-h` CSS variable that pages can set
 * if/when they render a sticky bottom bar (currently unused but the
 * plumbing is here to avoid the next overlap bug). Mirrors the same
 * pattern used by `<AccessibilityButton>` so the two FABs stay
 * vertically aligned across breakpoints.
 */
const FAB_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-h, 0px) + 1.5rem)';

const WhatsAppButton = () => {
  const phoneNumber = '972553225141'; // Format: country code + number (no + or spaces)
  const whatsappUrl = `https://wa.me/${phoneNumber}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      // Peek behaviour: sit ~55% off the right edge so only a sliver is
      // visible while browsing, then slide fully into view on hover / focus
      // (desktop) and on tap (mobile — the group-hover state is triggered
      // by touch too since we're not gating on media queries). Keeps the
      // help affordance discoverable without blocking content behind it.
      className="fab-peek-right group fixed right-0 z-50 flex items-center justify-center w-16 h-16 rounded-l-2xl shadow-2xl transition-transform duration-300 ease-out"
      style={{ bottom: FAB_BOTTOM }}
      data-testid="whatsapp-button"
      aria-label="Chat on WhatsApp"
    >
      <img
        src="/images/whatsapp.png"
        alt="WhatsApp"
        className="w-16 h-16 rounded-2xl"
        draggable={false}
      />
    </a>
  );
};

export default WhatsAppButton;
