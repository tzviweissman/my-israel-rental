/**
 * Tiny "Default image" overlay badge — rendered over a property card's
 * cover photo when the lister hasn't uploaded their own. Tells visitors
 * the image is a placeholder and gently nudges the lister to add photos.
 */
import React from 'react';
import { ImageOff } from 'lucide-react';

const DefaultImageBadge = ({ className = '' }) => (
  <div
    className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-wide ${className}`}
    data-testid="default-image-badge"
  >
    <ImageOff size={10} />
    <span>Default image</span>
  </div>
);

export default DefaultImageBadge;
