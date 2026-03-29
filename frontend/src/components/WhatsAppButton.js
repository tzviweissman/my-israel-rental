import React from 'react';

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
      <svg
        viewBox="0 0 32 32"
        className="w-10 h-10"
        fill="white"
      >
        <path d="M16.002 0h-.004C7.164 0 0 7.164 0 16c0 3.5 1.128 6.74 3.042 9.372L1.054 31l5.803-1.952C9.372 30.872 12.612 32 16.002 32 24.84 32 32 24.836 32 16S24.84 0 16.002 0zm9.426 22.836c-.396 1.116-1.964 2.044-3.216 2.316-.852.184-1.956.332-5.684-.972-4.768-1.668-7.844-6.508-8.084-6.808-.236-.3-1.924-2.568-1.924-4.896 0-2.328 1.22-3.472 1.652-3.944.432-.472.944-.592 1.26-.592.316 0 .632.004.908.016.292.016.684-.112 1.068.816.396.956 1.348 3.284 1.464 3.524.116.24.196.52.04.82-.156.3-.236.488-.472.752-.236.264-.496.588-.708.792-.236.228-.484.476-.208.932.276.456 1.228 2.024 2.636 3.28 1.808 1.616 3.332 2.12 3.804 2.356.472.236.748.2.972-.116.224-.316.956-1.116 1.212-1.5.256-.384.512-.32.864-.192.352.128 2.236 1.056 2.62 1.248.384.192.64.288.732.448.092.16.092.924-.304 2.04z"/>
      </svg>
    </a>
  );
};

export default WhatsAppButton;
