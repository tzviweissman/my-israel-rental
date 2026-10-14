import { seenEnough } from './effects';

// docs/page-generation-rules.md §3f.10: a play-once showpiece starts when the visitor can
// see it, not when its edge first enters the screen.
const at = (top, height) => ({ top, bottom: top + height, height });

describe('seenEnough', () => {
  const vh = 900;
  it('waits while a short list is only partly on screen', () => {
    expect(seenEnough(at(800, 200), vh)).toBe(false); // edge in: the old start
    expect(seenEnough(at(701, 200), vh)).toBe(false);
  });
  it('starts once a short list is wholly on screen', () => {
    expect(seenEnough(at(700, 200), vh)).toBe(true);
  });
  it('starts a tall block once its top reaches the middle', () => {
    expect(seenEnough(at(600, 700), vh)).toBe(false);
    expect(seenEnough(at(450, 700), vh)).toBe(true);
    expect(seenEnough(at(300, 1400), vh)).toBe(true); // taller than the screen
  });
  it('counts a block already scrolled past, so a jump down never leaves it unplayed', () => {
    expect(seenEnough(at(-500, 200), vh)).toBe(true);
  });
});
