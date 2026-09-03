/**
 * motion-scroll-word-reveal — a paragraph whose words light up one after
 * another as a scroll progress value runs from 0 to 1.
 *
 * Ported from a TypeScript source (this project is CRA + JavaScript). Two
 * changes, both so it can share a section with something else:
 *
 * 1. IT TAKES ITS PROGRESS RATHER THAN MEASURING ITS OWN. The source owns a
 *    scroll container and a `useScroll` of its own. Here the section owns
 *    one progress value and hands it to both halves, which is the only way
 *    the words and the cards beside them can actually be in step — two
 *    independent measurements of the same scroll drift apart the moment
 *    their elements are different heights.
 *
 * 2. THE TEXT IS A PROP. The source hardcodes a sentence; ours comes from
 *    the translation file, in two languages.
 *
 * `useReducedMotion` still applies: with it on, every word is simply at
 * full opacity from the start. That is the safe failure too — a word only
 * ever goes from dim to lit, never from invisible, so a stalled progress
 * value leaves the sentence readable rather than blank.
 */
"use client";

import React, { Fragment } from "react";
import { motion, useReducedMotion, useTransform } from "motion/react";

import "./motion-scroll-word-reveal-utils/index.css";

const REST_OPACITY = 0.18;
const REVEAL_SPAN = 0.8;
const WORD_WINDOW = 0.2;

function getWordRange(index, count) {
  const start = count <= 1 ? 0 : (index / (count - 1)) * REVEAL_SPAN;
  return { start, end: Math.min(1, start + WORD_WINDOW) };
}

export function getWordOpacity(progress, { start, end }, rest = REST_OPACITY) {
  if (progress <= start) return rest;
  if (progress >= end) return 1;
  const t = (progress - start) / (end - start);
  return rest + (1 - rest) * t;
}

function Word({ children, progress, index, count, reducedMotion }) {
  const range = getWordRange(index, count);
  const opacity = useTransform(progress, (value) => getWordOpacity(value, range));
  return (
    <motion.span aria-hidden="true" style={reducedMotion ? undefined : { opacity }}>
      {children}
    </motion.span>
  );
}

/**
 * @param {Object} props
 * @param {string} props.text The sentence to reveal.
 * @param {import('motion/react').MotionValue<number>} props.progress
 * @param {string} [props.kicker]
 * @param {string} [props.headingId]
 */
export function ScrollWordReveal({ text, progress, kicker, headingId = "scroll-word-reveal-heading" }) {
  const reducedMotion = useReducedMotion();
  const words = String(text || "").split(" ").filter(Boolean);

  return (
    <div className="scroll-word-reveal__layout">
      <div className="scroll-word-reveal__progress" aria-hidden="true">
        <motion.span style={{ scaleY: reducedMotion ? 1 : progress }} />
      </div>
      <div className="scroll-word-reveal__content">
        {kicker ? <p className="scroll-word-reveal__kicker">{kicker}</p> : null}
        {/* aria-label carries the whole sentence and every span is
            aria-hidden, so a screen reader reads it once, in order, instead
            of word by word with the opacity noise. */}
        <h2 id={headingId} className="scroll-word-reveal__heading" aria-label={text}>
          {words.map((word, index) => (
            <Fragment key={`${word}-${index}`}>
              <Word
                progress={progress}
                index={index}
                count={words.length}
                reducedMotion={!!reducedMotion}
              >
                {word}
              </Word>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </h2>
      </div>
    </div>
  );
}

export default ScrollWordReveal;
