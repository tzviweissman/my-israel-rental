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
      className="fixed right-6 z-50 flex items-center justify-center w-16 h-16 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-110"
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
