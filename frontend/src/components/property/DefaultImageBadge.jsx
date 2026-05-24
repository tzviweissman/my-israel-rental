/**
 * Tiny overlay badge — rendered over a property card's cover photo when
 * the lister hasn't uploaded their own. Tells visitors the image is a
 * placeholder and nudges them to ask the lister for real photos.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';

const DefaultImageBadge = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-wide max-w-[calc(100%-1rem)] ${className}`}
      data-testid="default-image-badge"
    >
      <ImageOff size={10} className="shrink-0" />
      <span className="truncate">{t('property.reachOutForPictures', 'Reach out to lister for pictures')}</span>
    </div>
  );
};

export default DefaultImageBadge;
