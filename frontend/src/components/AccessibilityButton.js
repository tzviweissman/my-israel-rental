import React, { useState, useEffect } from 'react';
import { Eye, Plus, Minus, Sun, Moon } from 'lucide-react';

const AccessibilityButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [highContrast]);

  const increaseFontSize = () => {
    if (fontSize < 150) {
      setFontSize(fontSize + 10);
    }
  };

  const decreaseFontSize = () => {
    if (fontSize > 80) {
      setFontSize(fontSize - 10);
    }
  };

  const resetFontSize = () => {
    setFontSize(100);
  };

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 flex items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110"
        style={{ backgroundColor: '#4A90E2' }}
        data-testid="accessibility-button"
        aria-label="Accessibility Options"
      >
        <Eye size={32} color="white" />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 left-6 z-50 bg-white rounded-2xl shadow-2xl p-6 w-80"
          style={{ border: '2px solid #4A90E2' }}
          data-testid="accessibility-panel"
        >
          <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
            Accessibility Options
          </h3>

          <div className="space-y-4">
            {/* Font Size Controls */}
            <div>
              <label className="block text-sm font-medium mb-2">Text Size</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={decreaseFontSize}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  disabled={fontSize <= 80}
                  data-testid="decrease-font"
                >
                  <Minus size={20} />
                </button>
                <span className="flex-1 text-center font-medium">{fontSize}%</span>
                <button
                  onClick={increaseFontSize}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  disabled={fontSize >= 150}
                  data-testid="increase-font"
                >
                  <Plus size={20} />
                </button>
              </div>
              <button
                onClick={resetFontSize}
                className="mt-2 w-full text-sm text-blue-600 hover:underline"
                data-testid="reset-font"
              >
                Reset to Default
              </button>
            </div>

            {/* High Contrast Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">Display Mode</label>
              <button
                onClick={toggleHighContrast}
                className="w-full flex items-center justify-between p-3 rounded-lg border-2 hover:bg-gray-50 transition-colors"
                style={{ borderColor: highContrast ? '#4A90E2' : '#E5E5E5' }}
                data-testid="toggle-contrast"
              >
                <div className="flex items-center gap-3">
                  {highContrast ? <Sun size={20} /> : <Moon size={20} />}
                  <span>{highContrast ? 'High Contrast Mode' : 'Normal Mode'}</span>
                </div>
                <div
                  className={`w-12 h-6 rounded-full transition-colors ${
                    highContrast ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      highContrast ? 'translate-x-6' : 'translate-x-1'
                    } mt-0.5`}
                  ></div>
                </div>
              </button>
            </div>

            {/* Info Text */}
            <div className="text-xs text-gray-600 pt-2 border-t">
              <p>These settings help improve readability for users with vision impairments.</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .high-contrast {
          filter: contrast(1.5);
        }
        .high-contrast * {
          font-weight: 500 !important;
        }
      `}</style>
    </>
  );
};

export default AccessibilityButton;
