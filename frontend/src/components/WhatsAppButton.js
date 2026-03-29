import React from 'react';
import { MessageCircle } from 'lucide-react';

const WhatsAppButton = () => {
  const phoneNumber = '972553225141'; // Format: country code + number (no + or spaces)
  const whatsappUrl = `https://wa.me/${phoneNumber}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110"
      style={{ backgroundColor: '#25D366' }}
      data-testid="whatsapp-button"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle size={32} color="white" fill="white" />
    </a>
  );
};

export default WhatsAppButton;
