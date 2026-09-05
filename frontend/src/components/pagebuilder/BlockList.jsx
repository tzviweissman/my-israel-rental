/**
 * The renderer: a composition document in, a page out.
 *
 * This is the piece that makes P1 true rather than aspirational. There is
 * one registry, one loop, and no branch anywhere that takes a string from
 * the document and turns it into markup, a class name, a style or a URL.
 * A block type that is not in `REGISTRY` does not render; there is no
 * fallback that would draw "something" from an unrecognised entry,
 * because that fallback is exactly the escape hatch the whole design is
 * built to not have.
 *
 * WHAT THE DOCUMENT DECIDES: which blocks, in what order, with what
 * bounded props, under which six dial settings.
 *
 * WHAT IT DOES NOT: anything live. The reader's grid-or-rows choice,
 * their search text, how far they have scrolled through a long
 * catalogue - all of that is page state and arrives through `ctx`, the
 * same way an image gallery's current frame has always been the caller's
 * business rather than the component's. A document that could hold the
 * reader's search box open would be a document that fights the reader.
 *
 * WHY THE THEME IS AN ATTRIBUTE AND THE ACCENT IS INLINE. The six dials
 * become `data-*` attributes read by styles/page-theme.css, so everything
 * that follows from "airy" lives in one file. The accent is the one thing
 * that cannot: its four values live in utils/businessAccent.js and must
 * keep living in exactly one place, so they are handed to the CSS as
 * custom properties rather than written down a second time.
 */
import React from 'react';

import { themeAttrs, readComposition } from '../../utils/pageComposition';
import { accentColors, accentFor } from '../../utils/businessAccent';
import ServicesBlock from './ServicesBlock';
import {
  BlockShell, HeroBlock, RuleBlock, FactsBlock,
  ProvidersBlock, CoverBlock, GalleryBlock, ContactBlock,
} from './SimpleBlocks';

/** The closed vocabulary, on the drawing side. Mirrors BLOCKS in
 *  backend/utils/page_composition.py; check-page-builder.mjs asserts the
 *  two hold the same eight names rather than trusting them to. */
export const REGISTRY = {
  hero: HeroBlock,
  rule: RuleBlock,
  facts: FactsBlock,
  services: ServicesBlock,
  providers: ProvidersBlock,
  cover: CoverBlock,
  gallery: GalleryBlock,
  contact: ContactBlock,
};

export const BLOCK_NAMES = Object.keys(REGISTRY);

export default function BlockList({ business, ctx, className = '' }) {
  const composition = readComposition(business);
  const accentName = accentFor(business);
  const colors = accentColors(business);
  const attrs = themeAttrs(composition.theme);

  return (
    <div
      className={className}
      {...attrs}
      style={{
        '--pg-accent': colors.tint,
        '--pg-accent-on': colors.on,
        '--pg-rule': colors.rule,
      }}
      data-testid="page-blocks"
      data-block-count={composition.blocks.length}
    >
      {composition.blocks.map((block) => {
        const Component = REGISTRY[block.type];
        // Not a defensive nicety: readComposition has already dropped
        // unknown types, so reaching here means the two disagree and the
        // right answer is still to draw the rest of the page.
        if (!Component) return null;
        return (
          <BlockShell key={block.id} id={block.id} type={block.type}>
            <Component block={block} ctx={{ ...ctx, business, accent: accentName }} />
          </BlockShell>
        );
      })}
    </div>
  );
}
