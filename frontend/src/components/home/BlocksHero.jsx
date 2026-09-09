import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

/**
 * The preview page's hero: hundreds of glass blocks that tumble in, stack
 * into a rotating cube, burst, flatten into a field of tiles, stream into
 * a ribbon, and resolve into the site's mark.
 *
 * Built in code after three rounds of generated video could not hold the
 * choreography. Compared frame by frame against the reference Tzvi sent,
 * this pass closes the gaps that reading the two side by side made plain:
 *
 * 1. SCALE. The reference fills its frame and lets the shapes run off the
 *    edges; the first build kept everything inside, which read as a small
 *    object on a table. Tzvi approved cropping on 9 Sep, so the camera now
 *    sits close and the cube, the field and the ribbon all overflow. The
 *    MARK is the exception: a logo cut in half is not a logo, so its
 *    keyframes pull back far enough to hold it whole.
 * 2. DEPTH OF FIELD. The reference is shot like a macro lens, the blocks
 *    nearest the lens melting into blur. A BokehPass focused on the
 *    camera's own target does the same here, and it is most of what
 *    separates the look from a diagram.
 * 3. MATERIAL. Reference blocks carry colour inside the volume, shifting
 *    across each block. Every instance here has two colours mixed along
 *    its local height by a small shader injection, so no block is one
 *    flat tone.
 * 4. SIZE VARIETY. The reference mixes big slabs, small chips and thin
 *    bars. A single repeated size is what made the first build read as
 *    generated, so every block carries a persistent size class used
 *    wherever the formation is loose. The cube and the mark stay uniform,
 *    because those two shapes are grids.
 *
 * One instanced mesh, one draw call. Every block has a pose in each of the
 * seven keyframes below; the timeline blends neighbouring keyframes with a
 * per-block stagger, and each flight arcs, drifts, spins and settles with
 * a small overshoot. The camera follows a closed Catmull-Rom path, so the
 * 24s loop has no seam.
 *
 * The copy sits on a solid white panel at the inline-start (the top up to
 * 1000px), and the scene is centred in the clear area beside it by an
 * off-centre view offset.
 */

const N = 512;                  // 8 x 8 x 8, the cube
const LOOP = 24;                // seconds
const PANEL_INLINE = 0.58;      // the panel plus its fade, as a fraction of the width (desktop)
const PANEL_TOP_PX = 432;       // the copy's height when the panel is on top, phones
const PANEL_TOP_WIDE_PX = 470;  // the same above 760px, where the headline is larger
const STACK_MAX = 1000;         // up to this width the copy sits above the scene

// How much of the world the clear area should show, in world units, and
// the distance the camera keyframes below are authored at. A formation
// larger than SUBJECT overflows and crops, which is the point.
const SUBJECT = 7;
const REF_DIST = 11;

// Sampled from the reference: saturated glass in coral, magenta, violet,
// blue and amber, plus the frosted near-whites it mixes through them.
const PALETTE = [
  '#E7A63A', '#DE6A46', '#D2437E', '#DE7FA8', '#7A4BB0', '#A87BD2',
  '#4A76C8', '#4FA8CE', '#5CBBB4', '#DE8F4E', '#D65F6A', '#8A6BD2',
  // Frosted glass, a quarter of the set: it is what keeps a mass of
  // coloured blocks from reading as plastic confetti. Held well below
  // white, because on a white ground a near-white block does not read as
  // frosted, it reads as a hole.
  '#D7DCE6', '#E1E5EC', '#CED5E1', '#E6E3DD',
];
const GOLD_LOW = new THREE.Color('#A8650F');
const GOLD_HIGH = new THREE.Color('#F2C24A');
// The ribbon's bands, across its width, echoing the reference's arc.
const RIBBON_BANDS = ['#1F63E8', '#6D21C4', '#A02BC9', '#E2076B', '#EF4A1E', '#F07A10', '#F5B417', '#F2C24A'];

// The mark: 28 columns across brand/logo-mark.png, each the tower's height
// and its lift off the ground as fractions of the image height. Traced from
// the alpha channel; the zero at column 9 is the gap between the two groups
// of buildings.
const MARK_HEIGHTS = [0, 0.225, 0.275, 0.325, 0.375, 0.45, 0.55, 0.525, 0.525, 0, 0.3, 0.725, 0.8, 0.85, 0.9, 0.675, 0.65, 0.375, 0.575, 0.625, 0.125, 0.525, 0.475, 0.2, 0.275, 0.25, 0.25, 0.15];
const MARK_LIFT = [0, 0.025, 0.025, 0.025, 0.025, 0.05, 0.025, 0.05, 0.025, 0, 0.025, 0.05, 0.05, 0.05, 0.05, 0.225, 0.2, 0.175, 0.025, 0.025, 0.5, 0.05, 0.05, 0.025, 0.025, 0.05, 0.025, 0.05];

const RIB_SAMPLES = 512;        // baked poses around the ribbon loop
const RIB_LANES = 8;
const RIB_FLOW = 0.06;          // loops per second while the ribbon holds

// Deterministic randomness, so every visitor sees the same film.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutExpo = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
const easeInQuad = (u) => u * u;
// Arrives a little past the target and settles back: the snap of a block
// locking into the cube or a tower.
const easeOutBack = (u) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

/** Builds the keyframes. Each is { pos, quat, scale, color, color2 } as flat arrays. */
function buildKeyframes() {
  const rnd = mulberry32(20260909);
  const make = () => ({
    pos: new Float32Array(N * 3), quat: new Float32Array(N * 4), scale: new Float32Array(N * 3),
    color: new Float32Array(N * 3), color2: new Float32Array(N * 3),
  });
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const setQ = (k, i, qq) => { k.quat[i * 4] = qq.x; k.quat[i * 4 + 1] = qq.y; k.quat[i * 4 + 2] = qq.z; k.quat[i * 4 + 3] = qq.w; };
  const setP = (k, i, x, y, z) => { k.pos[i * 3] = x; k.pos[i * 3 + 1] = y; k.pos[i * 3 + 2] = z; };
  const setS = (k, i, x, y, z) => { k.scale[i * 3] = x; k.scale[i * 3 + 1] = y; k.scale[i * 3 + 2] = z; };
  const setC = (k, i, a, b) => {
    k.color[i * 3] = a.r; k.color[i * 3 + 1] = a.g; k.color[i * 3 + 2] = a.b;
    k.color2[i * 3] = b.r; k.color2[i * 3 + 1] = b.g; k.color2[i * 3 + 2] = b.b;
  };
  const randQ = () => q.setFromEuler(e.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2));

  // Two colours per block, mixed up its local height: the reference's
  // blocks are never one flat tone. The second is a near neighbour in the
  // palette, sometimes a frosted white, so the gradient stays in family.
  const colA = new Array(N), colB = new Array(N);
  // Persistent size class: big slabs, medium, chips, and thin bars. Used
  // wherever the formation is loose; the cube and the mark ignore it.
  const size = new Float32Array(N), isBar = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const j = Math.floor(rnd() * PALETTE.length);
    colA[i] = new THREE.Color(PALETTE[j]);
    colB[i] = new THREE.Color(PALETTE[(j + 1 + Math.floor(rnd() * 3)) % PALETTE.length]);
    const r = rnd();
    size[i] = r < 0.16 ? 1.9 + rnd() * 0.7 : r < 0.48 ? 1.15 + rnd() * 0.35 : r < 0.8 ? 0.7 + rnd() * 0.3 : 0.4 + rnd() * 0.2;
    isBar[i] = rnd() < 0.18 ? 1 : 0;
  }

  // K0 sky: above and around, out of frame, ready to tumble in.
  const sky = make();
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2; const r = 3 + rnd() * 8;
    setP(sky, i, Math.cos(a) * r, 9 + rnd() * 11, Math.sin(a) * r);
    setQ(sky, i, randQ()); setS(sky, i, size[i], size[i], size[i]); setC(sky, i, colA[i], colB[i]);
  }

  // K1 pile: a dense drift of blocks near the ground, wider than the frame
  // at the close keyframes, so the camera passes through it rather than
  // looking at it.
  const pile = make();
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * 7.5;
    setP(pile, i, Math.cos(a) * r, size[i] * 0.5 + rnd() * 1.8, Math.sin(a) * r);
    setQ(pile, i, q.setFromEuler(e.set(0, rnd() * Math.PI, 0)));
    setS(pile, i, size[i], size[i], size[i]); setC(pile, i, colA[i], colB[i]);
  }

  // K2 cube: 8 x 8 x 8, uniform, floating a little above the ground. Its
  // spin is applied at run time so it turns while it holds.
  const cube = make();
  for (let i = 0; i < N; i++) {
    const x = i % 8, y = Math.floor(i / 8) % 8, z = Math.floor(i / 64);
    setP(cube, i, (x - 3.5) * 1.02, y * 1.02 + 1.4, (z - 3.5) * 1.02);
    setQ(cube, i, q.identity()); setS(cube, i, 1, 1, 1); setC(cube, i, colA[i], colB[i]);
  }

  // K3 cloud: burst outward into an ellipsoid, sizes back in play.
  const cloud = make();
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.cbrt(rnd());
    const s = Math.sqrt(1 - u * u);
    setP(cloud, i, r * s * Math.cos(th) * 8, 5.5 + r * u * 4.5, r * s * Math.sin(th) * 8);
    setQ(cloud, i, randQ()); setS(cloud, i, size[i], size[i], size[i]); setC(cloud, i, colA[i], colB[i]);
  }

  // K4 field: the reference's mosaic hangs in the air as a curtain seen
  // side on, tiles at many depths, broad frosted panels behind small
  // colour chips. Laid flat it read as a tiled floor instead.
  const mosaic = make();
  for (let i = 0; i < N; i++) {
    const gx = i % 32, gy = Math.floor(i / 32);
    const jx = (rnd() - 0.5) * 0.55, jy = (rnd() - 0.5) * 0.55;
    setP(mosaic, i, (gx - 15.5) * 0.74 + jx, 0.8 + gy * 0.68 + jy, (rnd() - 0.5) * 4.5);
    setQ(mosaic, i, q.identity());
    // Thin in Z: the tiles face the camera and the curtain stands up.
    if (isBar[i]) {
      if (rnd() < 0.5) setS(mosaic, i, 1.5 * size[i], 0.22 * size[i], 0.1);
      else setS(mosaic, i, 0.22 * size[i], 1.5 * size[i], 0.1);
    } else setS(mosaic, i, 0.9 * size[i], 0.9 * size[i], 0.11);
    setC(mosaic, i, colA[i], colB[i]);
  }

  // K5 ribbon: a closed, tilted loop the tiles flow around, with tiles
  // wide enough to touch so it reads as one banded ribbon rather than a
  // string of chips. Colour runs across its width, as the reference's does.
  const ribbonU = new Float32Array(N), ribbonLane = new Float32Array(N);
  const loopPts = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    loopPts.push(new THREE.Vector3(Math.cos(a) * 11, 5.5 + Math.sin(a) * 3.4 + Math.sin(a * 2) * 1.3, Math.sin(a) * 5.5 - 0.5));
  }
  const loopCurve = new THREE.CatmullRomCurve3(loopPts, true, 'catmullrom', 0.5);
  const frames = loopCurve.computeFrenetFrames(RIB_SAMPLES, true);
  const ribPos = new Float32Array(RIB_SAMPLES * 3), ribQuat = new Float32Array(RIB_SAMPLES * 4), ribBin = new Float32Array(RIB_SAMPLES * 3);
  const m = new THREE.Matrix4();
  for (let k = 0; k < RIB_SAMPLES; k++) {
    const p = loopCurve.getPoint(k / RIB_SAMPLES);
    ribPos[k * 3] = p.x; ribPos[k * 3 + 1] = p.y; ribPos[k * 3 + 2] = p.z;
    const bin = frames.binormals[k];
    ribBin[k * 3] = bin.x; ribBin[k * 3 + 1] = bin.y; ribBin[k * 3 + 2] = bin.z;
    m.makeBasis(frames.tangents[k], frames.normals[k], bin); q.setFromRotationMatrix(m);
    ribQuat[k * 4] = q.x; ribQuat[k * 4 + 1] = q.y; ribQuat[k * 4 + 2] = q.z; ribQuat[k * 4 + 3] = q.w;
  }
  const perLane = N / RIB_LANES;
  const ribbon = make();
  const bandCols = RIBBON_BANDS.map((h) => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    const lane = i % RIB_LANES, k = Math.floor(i / RIB_LANES);
    ribbonU[i] = k / perLane; ribbonLane[i] = (lane - (RIB_LANES - 1) / 2) * 1.25;
    setS(ribbon, i, 1.5, 0.13, 1.35);
    setC(ribbon, i, bandCols[lane], bandCols[Math.min(RIB_LANES - 1, lane + 1)]);
    // Position and rotation come from the loop at run time; the arrays
    // hold the u = 0 pose so a debugger reading them sees something sane.
    setP(ribbon, i, ribPos[0], ribPos[1], ribPos[2]);
    setQ(ribbon, i, q.set(ribQuat[0], ribQuat[1], ribQuat[2], ribQuat[3]));
  }

  // K6 mark: the logo's towers, front layer first, then the ones behind;
  // blocks left over rest around the foot of the mark in their own colours.
  const mark = make();
  const cells = [];
  const unit = 0.46, maxH = 18;
  for (let layer = 0; layer < 3; layer++) {
    for (let col = 0; col < MARK_HEIGHTS.length; col++) {
      const h = Math.round(MARK_HEIGHTS[col] * maxH), lift = Math.round(MARK_LIFT[col] * maxH);
      for (let k = 0; k < h; k++) {
        cells.push({ x: (col - (MARK_HEIGHTS.length - 1) / 2) * unit, y: (lift + k + 0.5) * unit, z: (1 - layer) * unit, top: (lift + k + 1) / maxH });
      }
    }
  }
  // Assign cells in ribbon order so the ribbon feeds the towers front to back.
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => ribbonU[a] - ribbonU[b] || a - b);
  const litterRnd = mulberry32(7);
  for (let j = 0; j < N; j++) {
    const i = order[j];
    if (j < cells.length) {
      const cell = cells[j];
      setP(mark, i, cell.x, cell.y, cell.z);
      setQ(mark, i, q.identity()); setS(mark, i, unit, unit, unit);
      c.copy(GOLD_LOW).lerp(GOLD_HIGH, clamp01(cell.top * 1.05));
      setC(mark, i, c, GOLD_HIGH);
    } else {
      const a = litterRnd() * Math.PI * 2; const r = 6 + litterRnd() * 6;
      setP(mark, i, Math.cos(a) * r, unit / 2, Math.sin(a) * r);
      setQ(mark, i, q.setFromEuler(e.set(0, litterRnd() * Math.PI, 0)));
      setS(mark, i, unit, unit, unit); setC(mark, i, colA[i], colB[i]);
    }
  }

  // Per-transition ordering, 0..1 per block: what leads and what follows.
  const rank = {
    random: new Float32Array(N), cubeUp: new Float32Array(N), mosaicSweep: new Float32Array(N),
    ribbon: ribbonU, markTop: new Float32Array(N),
  };
  // Per-block flight character: a sideways drift direction and a spin axis.
  const drift = new Float32Array(N * 3), spinAxis = new Float32Array(N * 3), spinTurns = new Float32Array(N);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    rank.random[i] = rnd();
    rank.cubeUp[i] = (Math.floor(i / 8) % 8) / 8 + rnd() * 0.12;
    rank.mosaicSweep[i] = ((i % 32) / 32) * 0.8 + rnd() * 0.2;
    rank.markTop[i] = clamp01(1 - mark.pos[i * 3 + 1] / 9) * 0.8 + rnd() * 0.2;
    const a = rnd() * Math.PI * 2;
    drift[i * 3] = Math.cos(a); drift[i * 3 + 1] = 0; drift[i * 3 + 2] = Math.sin(a);
    v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    spinAxis[i * 3] = v.x; spinAxis[i * 3 + 1] = v.y; spinAxis[i * 3 + 2] = v.z;
    spinTurns[i] = 0.5 + rnd() * 1.5;
  }

  return { sky, pile, cube, cloud, mosaic, ribbon, mark, rank, drift, spinAxis, spinTurns, ribbonU, ribbonLane, ribPos, ribQuat, ribBin };
}

/**
 * The timeline. Holds animate the keyframe in place; moves blend from the
 * previous keyframe with a stagger, so the transition takes `dur` for each
 * block but the last block starts `stagger` seconds after the first.
 * `arc` lifts the flight, `swirl` drifts it sideways, `spin` turns the
 * block about its own axis on the way (whole turns, so it lands true).
 */
const TIMELINE = [
  { at: 0.0, to: 'pile', from: 'sky', dur: 2.4, stagger: 1.0, rank: 'random', ease: easeInQuad, arc: 0, swirl: 0.6, spin: 0.6 },
  { at: 3.3, to: 'cube', from: 'pile', dur: 1.6, stagger: 0.8, rank: 'cubeUp', ease: easeOutBack, arc: 1.6, swirl: 0.8, spin: 0.5 },
  { at: 8.4, to: 'cloud', from: 'cube', dur: 1.1, stagger: 0.12, rank: 'random', ease: easeOutExpo, arc: 0.4, swirl: 0.3, spin: 0.8 },
  { at: 10.8, to: 'mosaic', from: 'cloud', dur: 1.7, stagger: 0.9, rank: 'mosaicSweep', ease: easeInOut, arc: 0, swirl: 0.5, spin: 0.5 },
  { at: 14.4, to: 'ribbon', from: 'mosaic', dur: 1.4, stagger: 1.6, rank: 'mosaicSweep', ease: easeInOut, arc: 1.2, swirl: 0.4, spin: 0 },
  { at: 17.6, to: 'mark', from: 'ribbon', dur: 1.5, stagger: 1.1, rank: 'ribbon', ease: easeOutBack, arc: 1.5, swirl: 0.6, spin: 0.5 },
  { at: 22.2, to: 'sky', from: 'mark', dur: 1.2, stagger: 0.5, rank: 'markTop', ease: easeInOut, arc: 0, swirl: 0.8, spin: 0.7 }, // ends at 23.9, inside the loop
];

/**
 * Camera path: closed, so the loop's seam is invisible. Distances are
 * authored against REF_DIST and scaled to the clear area at run time.
 * The close keyframes (5.4 to 7.4) put the lens inside the formation, the
 * way the reference does; the two mark keyframes pull back, because a
 * cropped logo is not a logo.
 */
const CAMERA = [
  // Aimed high at the open, or the blocks are still above the frame while
  // they fall and the loop starts on an empty screen.
  { t: 0.0, pos: [7, 9, 15], look: [0, 8, 0] },
  { t: 3.3, pos: [6, 4.5, 10], look: [0, 2.6, 0] },
  // The one pass inside the formation, brief, the way the reference dives
  // through its blocks before it shows the cube.
  { t: 5.2, pos: [3.5, 5, 4.5], look: [0, 4.6, 0] },
  { t: 6.8, pos: [8, 6.5, 13], look: [0, 5, 0] },
  { t: 8.2, pos: [-7, 7, 12], look: [0, 5, 0] },
  { t: 9.6, pos: [-8, 7, 12], look: [0, 5.5, 0] },
  { t: 12.4, pos: [-2.5, 6, 13], look: [0, 5.5, 0] },
  { t: 14.4, pos: [7, 4, 12], look: [-1, 4, 0] },
  { t: 16.8, pos: [4, 9.5, 21], look: [0, 5.5, 0] },
  { t: 19.4, pos: [0, 5, 21], look: [0, 4, 0] },
  { t: 22.4, pos: [3, 5.5, 22], look: [0, 4, 0] },
  { t: LOOP, pos: [7, 9, 15], look: [0, 8, 0] },
];

function cameraCurve(key) {
  const pts = CAMERA.slice(0, -1).map((k) => new THREE.Vector3(...k[key]));
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}

/** Maps a loop time to the closed camera curve's parameter (uniform per segment). */
function cameraParam(t) {
  const n = CAMERA.length - 1;
  for (let k = 0; k < n; k++) {
    const a = CAMERA[k].t, b = CAMERA[k + 1].t;
    if (t >= a && t < b) return (k + (t - a) / (b - a)) / n;
  }
  return 0;
}

function layoutFor(width, height, rtl) {
  if (width <= STACK_MAX) {
    const top = width <= 760 ? PANEL_TOP_PX : PANEL_TOP_WIDE_PX;
    const visH = Math.max(160, height - top);
    return { cx: 0.5, cy: (top + height) / (2 * height), visW: width, visH };
  }
  const visW = width * (1 - PANEL_INLINE);
  const cx = rtl ? (1 - PANEL_INLINE) / 2 : PANEL_INLINE + (1 - PANEL_INLINE) / 2;
  return { cx, cy: 0.5, visW, visH: height };
}

export default function BlocksHero({ className = 'hv2-blocks' }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (err) {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping; // ACES desaturated the glass to pastel

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 30, 62);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 120);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(9, 16, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    // A cool rim from behind: the second light glass needs to show its edges.
    const rim = new THREE.DirectionalLight(0xdbe8ff, 0.8);
    rim.position.set(-12, 9, -14);
    scene.add(rim);

    // A plain white ground with a soft shadow, no reflection: the
    // reference's blocks sit in an open void, not on a glossy tabletop.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Softly bevelled edges catch the highlights: most of what makes a block
    // read as glass rather than plastic.
    const geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.07);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.22, metalness: 0,
      transmission: 0.35, thickness: 1.2, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.12,
      // 2.2 here, with the clearcoat and a 2.1 sun, burned whole faces to
      // pure white and took their colour with them.
      specularIntensity: 0.8, envMapIntensity: 1.25,
      transparent: true, opacity: 0.9,
    });
    // Each block carries a second colour, mixed along its own height, so
    // the colour lives in the volume the way the reference's does.
    const color2 = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    geometry.setAttribute('aColor2', color2);
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aColor2;\nvarying vec3 vColorB;\nvarying float vGrad;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvColorB = aColor2;\nvGrad = clamp( position.y + 0.5, 0.0, 1.0 );');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vColorB;\nvarying float vGrad;')
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix( vColor, vColorB, vGrad );');
    };
    const mesh = new THREE.InstancedMesh(geometry, material, N);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // The instance matrices change every frame, so the bounding sphere
    // three computes once is always stale. It never showed while the
    // camera stayed far, and blanked the whole scene the moment the
    // close keyframes landed: the stale sphere fell outside the frustum
    // and the one mesh in the scene was culled.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);

    const K = buildKeyframes();
    const camPos = cameraCurve('pos');
    const camLook = cameraCurve('look');

    // Depth of field. The reference is shot close with a shallow plane of
    // focus, and the blur on the blocks nearest the lens is most of what
    // separates it from a diagram.
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bokeh = new BokehPass(scene, camera, { focus: 11, aperture: 0.0022, maxblur: 0.012 });
    composer.addPass(bokeh);

    // Scratch objects for the per-frame pose blend.
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), p = new THREE.Vector3();
    const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qq = new THREE.Quaternion();
    const sA = new THREE.Vector3(), sB = new THREE.Vector3(), s = new THREE.Vector3();
    const cA = new THREE.Color(), cB = new THREE.Color(), col = new THREE.Color();
    const c2A = new THREE.Color(), c2B = new THREE.Color(), col2 = new THREE.Color();
    const mat = new THREE.Matrix4();
    const camP = new THREE.Vector3(), camL = new THREE.Vector3();
    const rotQ = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3();

    // Live poses: a keyframe plus what it does while it holds.
    const readPose = (k, i, t, outP, outQ, outS, outC, outC2) => {
      const key = K[k];
      outS.set(key.scale[i * 3], key.scale[i * 3 + 1], key.scale[i * 3 + 2]);
      outC.setRGB(key.color[i * 3], key.color[i * 3 + 1], key.color[i * 3 + 2]);
      outC2.setRGB(key.color2[i * 3], key.color2[i * 3 + 1], key.color2[i * 3 + 2]);
      if (k === 'ribbon') {
        // Sampled from the loop: the tile's own place plus the flow so far.
        let u = K.ribbonU[i] + (t - 14.4) * RIB_FLOW;
        u -= Math.floor(u);
        const idx = Math.min(RIB_SAMPLES - 1, Math.floor(u * RIB_SAMPLES));
        const off = K.ribbonLane[i];
        outP.set(K.ribPos[idx * 3] + K.ribBin[idx * 3] * off, K.ribPos[idx * 3 + 1] + K.ribBin[idx * 3 + 1] * off, K.ribPos[idx * 3 + 2] + K.ribBin[idx * 3 + 2] * off);
        outQ.set(K.ribQuat[idx * 4], K.ribQuat[idx * 4 + 1], K.ribQuat[idx * 4 + 2], K.ribQuat[idx * 4 + 3]);
        return;
      }
      outP.set(key.pos[i * 3], key.pos[i * 3 + 1], key.pos[i * 3 + 2]);
      outQ.set(key.quat[i * 4], key.quat[i * 4 + 1], key.quat[i * 4 + 2], key.quat[i * 4 + 3]);
      if (k === 'cube') {
        // The whole cube turns slowly about its centre and breathes a little.
        const th = (t - 3.3) * 0.32;
        rotQ.setFromAxisAngle(yAxis, th);
        outP.y -= 5.0; outP.applyQuaternion(rotQ); outP.y += 5.0 + Math.sin(t * 0.9) * 0.15;
        outQ.premultiply(rotQ);
      } else if (k === 'cloud') {
        // The cloud drifts and each block turns a little.
        const w = t * 0.6 + i * 0.37;
        outP.x += Math.sin(w) * 0.35; outP.y += Math.cos(w * 0.8) * 0.3; outP.z += Math.sin(w * 1.3) * 0.35;
        rotQ.setFromAxisAngle(yAxis, t * 0.4 + i);
        outQ.premultiply(rotQ);
      } else if (k === 'sky') {
        // Blocks in the sky keep tumbling.
        rotQ.setFromAxisAngle(yAxis, t * 1.5 + i);
        outQ.premultiply(rotQ);
      } else if (k === 'mosaic') {
        // A slow swell runs across the curtain, in depth rather than
        // height, so the tiles breathe towards the lens.
        outP.z += Math.sin(t * 1.2 + outP.x * 0.45) * 0.35;
      }
    };

    // The keyframe that holds at time t, and the move in progress if any.
    const stateAt = (t) => {
      // The first move starts at 0, so a loop time in [0, LOOP) always
      // lands on one; the fallback is the last move, for a time that has
      // wrapped below zero (a frame stamped before the loop's start time).
      let move = TIMELINE[TIMELINE.length - 1];
      for (let j = 0; j < TIMELINE.length; j++) {
        if (t >= TIMELINE[j].at) move = TIMELINE[j];
      }
      const end = move.at + move.dur + move.stagger;
      return t < end ? { holding: move.to, move } : { holding: move.to, move: null };
    };

    const renderAt = (t) => {
      const { move, holding } = stateAt(t);
      const c2 = color2.array;
      for (let i = 0; i < N; i++) {
        if (!move) {
          readPose(holding, i, t, p, qq, s, col, col2);
        } else {
          const start = move.at + K.rank[move.rank][i] * move.stagger;
          const u = clamp01((t - start) / move.dur);
          const w = move.ease(u);
          readPose(move.from, i, t, pA, qA, sA, cA, c2A);
          readPose(move.to, i, t, pB, qB, sB, cB, c2B);
          // Flight: an arc up, a sideways drift, and a spin about the
          // block's own axis, all zero at both ends so it leaves and lands
          // exactly on the keyed poses.
          const bump = Math.sin(Math.PI * u);
          p.lerpVectors(pA, pB, w);
          p.y += bump * move.arc;
          p.x += bump * move.swirl * K.drift[i * 3];
          p.z += bump * move.swirl * K.drift[i * 3 + 2];
          qq.slerpQuaternions(qA, qB, w);
          if (move.spin > 0) {
            axis.set(K.spinAxis[i * 3], K.spinAxis[i * 3 + 1], K.spinAxis[i * 3 + 2]);
            rotQ.setFromAxisAngle(axis, easeInOut(u) * Math.PI * 2 * Math.round(K.spinTurns[i] * move.spin));
            qq.multiply(rotQ);
          }
          s.lerpVectors(sA, sB, w);
          col.lerpColors(cA, cB, w);
          col2.lerpColors(c2A, c2B, w);
        }
        mat.compose(p, qq, s);
        mesh.setMatrixAt(i, mat);
        mesh.setColorAt(i, col);
        c2[i * 3] = col2.r; c2[i * 3 + 1] = col2.g; c2[i * 3 + 2] = col2.b;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      color2.needsUpdate = true;

      const u = cameraParam(t);
      camPos.getPoint(u, camP);
      camLook.getPoint(u, camL);
      // The authored distance, scaled so the clear area shows SUBJECT
      // units. A formation larger than that overflows and crops, which is
      // how the reference is framed.
      camP.sub(camL).multiplyScalar(fit).add(camL);
      camera.position.copy(camP);
      camera.lookAt(camL);
      // Focus travels with the subject, so the blocks nearest the lens blur.
      if (bokeh.uniforms && bokeh.uniforms.focus) bokeh.uniforms.focus.value = Math.max(1, camP.distanceTo(camL));
      composer.render();
    };

    let fit = 1;
    const resize = () => {
      const host = canvas.parentElement || canvas;
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      const rtl = (document.documentElement.getAttribute('dir') || '').toLowerCase() === 'rtl';
      const L = layoutFor(w, h, rtl);
      // Shift the projection so the scene's centre lands in the clear area.
      camera.setViewOffset(w, h, (0.5 - L.cx) * w, (0.5 - L.cy) * h, w, h);
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const dW = (SUBJECT / 2) / (tanHalf * camera.aspect) * (w / L.visW);
      const dH = (SUBJECT / 2) / tanHalf * (h / L.visH);
      fit = Math.max(dW, dH) / REF_DIST;
      fit = Math.min(Math.max(fit, 0.8), 3.2);
      // The fog and the shadow frustum are authored for fit = 1; a camera
      // pulled back past the fog would see nothing.
      scene.fog.near = 30 * fit; scene.fog.far = 62 * fit;
      camera.far = 120 * fit;
      const sb = 24 * fit;
      sun.shadow.camera.left = -sb; sun.shadow.camera.right = sb;
      sun.shadow.camera.top = sb; sun.shadow.camera.bottom = -sb;
      sun.shadow.camera.far = 60 * fit;
      sun.position.set(9 * fit, 16 * fit, 7 * fit);
      sun.shadow.camera.updateProjectionMatrix();
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement || canvas);
    const dirObserver = new MutationObserver(resize);
    dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let running = true, visible = true;
    let t0 = performance.now();
    const dev = process.env.NODE_ENV === 'development';
    let pinned = null;
    const loop = (now) => {
      if (!running || !visible || document.hidden) return;
      let t = pinned == null ? ((now - t0) / 1000) % LOOP : pinned;
      if (t < 0) t += LOOP;
      renderAt(t);
      if (dev) window.__blocksHeroFrames = (window.__blocksHeroFrames || 0) + 1;
    };
    if (dev) {
      window.__blocksHeroSeek = (t) => { pinned = t; };
      // CPU milliseconds per frame: the pose blend plus draw submission.
      window.__blocksHeroBench = (n = 40) => {
        const t1 = performance.now();
        for (let k = 0; k < n; k++) renderAt((k / n) * LOOP);
        return (performance.now() - t1) / n;
      };
      // One frame as a JPEG data URL: how the fallback poster is made.
      window.__blocksHeroCapture = (t = 20.6) => { renderAt(t); return canvas.toDataURL('image/jpeg', 0.85); };
    }
    const start = () => {
      if (reduced.matches) { renderAt(20.4); renderer.setAnimationLoop(null); return; }
      t0 = performance.now() - 1000;
      renderer.setAnimationLoop(loop);
    };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden && running) start(); };
    document.addEventListener('visibilitychange', onVis);
    reduced.addEventListener('change', start);
    start();

    return () => {
      running = false;
      renderer.setAnimationLoop(null);
      if (dev) { delete window.__blocksHeroSeek; delete window.__blocksHeroFrames; delete window.__blocksHeroBench; delete window.__blocksHeroCapture; }
      io.disconnect(); ro.disconnect(); dirObserver.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reduced.removeEventListener('change', start);
      composer.dispose();
      geometry.dispose(); material.dispose(); ground.geometry.dispose(); ground.material.dispose();
      pmrem.dispose(); renderer.dispose();
    };
  }, []);

  if (failed) {
    return <img className={className} src="/images/preview-hero/blocks-poster.jpg" alt="" aria-hidden="true" data-testid="home-preview-blocks-still" />;
  }
  return <canvas ref={ref} className={className} aria-hidden="true" data-testid="home-preview-blocks" />;
}
