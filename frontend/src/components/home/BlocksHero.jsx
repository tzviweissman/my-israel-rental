import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * The preview page's hero, built in code after three rounds of generated
 * video could not match the reference Tzvi sent (a motion piece where
 * hundreds of glass blocks tumble in, stack into a rotating cube, burst
 * into a cloud, flatten into a mosaic of tiles, stream into a curved
 * ribbon, and resolve). Generated video reinterprets that every render and
 * morphs between the stages; this moves the same 512 blocks through the
 * same six shapes, in order, smoothly, on a loop that closes on itself.
 *
 * The sixth shape is the site's own mark: the blocks stack into the tower
 * profile traced from brand/logo-mark.png and turn gold glass.
 *
 * One instanced mesh, one draw call. Every block has a pose (position,
 * rotation, scale, colour) in each of the seven keyframes below, and the
 * timeline blends neighbouring keyframes with a per-block stagger so the
 * blocks stream rather than move as one. Flights are not straight lines:
 * each block rises on an arc, drifts sideways, spins about its own axis,
 * and settles with a small overshoot, which is most of the difference
 * between a morph and something a motion designer would have keyed. The
 * ribbon is a closed loop the tiles flow around while it holds, so the
 * mosaic peels into a moving stream rather than a parked arch. The camera
 * follows a closed Catmull-Rom path, so it never stops and the last frame
 * flows into the first.
 *
 * The copy sits on a solid white panel at the inline-start (the top up to
 * 1000px). The scene is framed into the clear area by an off-centre view
 * offset and a camera distance fitted to that area, with a floor on how
 * close the camera may come, so nothing is ever cropped at any width.
 */

const N = 512;                  // 8 x 8 x 8, the cube
const LOOP = 24;                // seconds
const PANEL_INLINE = 0.58;      // the panel plus its fade, as a fraction of the width (desktop)
const PANEL_TOP_PX = 432;       // the copy's height when the panel is on top, phones
const PANEL_TOP_WIDE_PX = 470;  // the same above 760px, where the headline is larger
const STACK_MAX = 1000;         // up to this width the copy sits above the scene

// Sampled from the reference: coral, magenta, pinks, purples, blues, teal,
// amber, and a share of clear blocks.
const PALETTE = [
  '#F7C948', '#F0532B', '#E8177C', '#F26AA6', '#7B2FBE', '#B274E6',
  '#2C7BE5', '#39C3F2', '#3ED2C5', '#EE8B1E', '#F4F5F9', '#F4F5F9', '#E9ECF3',
];
const GOLD_LOW = new THREE.Color('#A8650F');
const GOLD_HIGH = new THREE.Color('#F2C24A');

// The mark: 28 columns across brand/logo-mark.png, each the tower's height
// and its lift off the ground as fractions of the image height. Traced from
// the alpha channel; the zero at column 9 is the gap between the two groups
// of buildings.
const MARK_HEIGHTS = [0, 0.225, 0.275, 0.325, 0.375, 0.45, 0.55, 0.525, 0.525, 0, 0.3, 0.725, 0.8, 0.85, 0.9, 0.675, 0.65, 0.375, 0.575, 0.625, 0.125, 0.525, 0.475, 0.2, 0.275, 0.25, 0.25, 0.15];
const MARK_LIFT = [0, 0.025, 0.025, 0.025, 0.025, 0.05, 0.025, 0.05, 0.025, 0, 0.025, 0.05, 0.05, 0.05, 0.05, 0.225, 0.2, 0.175, 0.025, 0.025, 0.5, 0.05, 0.05, 0.025, 0.025, 0.05, 0.025, 0.05];

const RIB_SAMPLES = 512;        // baked poses around the ribbon loop
const RIB_LANES = 8;
const RIB_FLOW = 0.075;         // loops per second while the ribbon holds

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

/** Builds the keyframes. Each is { pos, quat, scale, color } as flat arrays. */
function buildKeyframes() {
  const rnd = mulberry32(20260909);
  const make = () => ({
    pos: new Float32Array(N * 3), quat: new Float32Array(N * 4), scale: new Float32Array(N * 3), color: new Float32Array(N * 3),
  });
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const setQ = (k, i, qq) => { k.quat[i * 4] = qq.x; k.quat[i * 4 + 1] = qq.y; k.quat[i * 4 + 2] = qq.z; k.quat[i * 4 + 3] = qq.w; };
  const setP = (k, i, x, y, z) => { k.pos[i * 3] = x; k.pos[i * 3 + 1] = y; k.pos[i * 3 + 2] = z; };
  const setS = (k, i, x, y, z) => { k.scale[i * 3] = x; k.scale[i * 3 + 1] = y; k.scale[i * 3 + 2] = z; };
  const setC = (k, i, col) => { k.color[i * 3] = col.r; k.color[i * 3 + 1] = col.g; k.color[i * 3 + 2] = col.b; };
  const randQ = () => q.setFromEuler(e.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2));

  const base = new Array(N);
  for (let i = 0; i < N; i++) base[i] = new THREE.Color(PALETTE[Math.floor(rnd() * PALETTE.length)]);

  // K0 sky: above and around, out of frame, ready to tumble in.
  const sky = make();
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2; const r = 4 + rnd() * 9;
    setP(sky, i, Math.cos(a) * r, 18 + rnd() * 16, Math.sin(a) * r);
    setQ(sky, i, randQ()); setS(sky, i, 1, 1, 1); setC(sky, i, base[i]);
  }

  // K1 pile: landed loose on the ground, a few on top of others.
  const pile = make();
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * 6.5;
    const stacked = rnd() < 0.18;
    setP(pile, i, Math.cos(a) * r, stacked ? 1.5 : 0.5, Math.sin(a) * r);
    setQ(pile, i, q.setFromEuler(e.set(0, rnd() * Math.PI, 0)));
    setS(pile, i, 1, 1, 1); setC(pile, i, base[i]);
  }

  // K2 cube: 8 x 8 x 8, floating a little above the ground. Rotation is
  // applied at run time so the cube turns while it holds.
  const cube = make();
  for (let i = 0; i < N; i++) {
    const x = i % 8, y = Math.floor(i / 8) % 8, z = Math.floor(i / 64);
    setP(cube, i, (x - 3.5) * 1.02, y * 1.02 + 1.0, (z - 3.5) * 1.02);
    setQ(cube, i, q.identity()); setS(cube, i, 1, 1, 1); setC(cube, i, base[i]);
  }

  // K3 cloud: burst outward into an ellipsoid.
  const cloud = make();
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.cbrt(rnd());
    const s = Math.sqrt(1 - u * u);
    setP(cloud, i, r * s * Math.cos(th) * 8.5, 6 + r * u * 4.5, r * s * Math.sin(th) * 8.5);
    setQ(cloud, i, randQ()); setS(cloud, i, 1, 1, 1); setC(cloud, i, base[i]);
  }

  // K4 mosaic: a 32 x 16 field of thin tiles lying flat, sizes varied, with
  // a share of narrow bars the way the reference mixes them.
  const mosaic = make();
  for (let i = 0; i < N; i++) {
    const gx = i % 32, gz = Math.floor(i / 32);
    const bar = rnd() < 0.2;
    setP(mosaic, i, (gx - 15.5) * 0.86, 0.07, (gz - 7.5) * 0.86);
    setQ(mosaic, i, q.setFromEuler(e.set(0, bar && rnd() < 0.5 ? Math.PI / 2 : 0, 0)));
    setS(mosaic, i, bar ? 0.24 : 0.55 + rnd() * 0.35, 0.12, bar ? 0.95 : 0.55 + rnd() * 0.35);
    setC(mosaic, i, base[i]);
  }

  // K5 ribbon: a closed, tilted loop the tiles flow around. The keyframe
  // holds each block's lane and its starting place on the loop; the pose
  // itself is sampled at run time from the baked loop so it can flow.
  const ribbonU = new Float32Array(N), ribbonLane = new Float32Array(N);
  const loopPts = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    // An elongated loop, tilted so the near side rides high and curls: the
    // far side runs low along the back, the near side sweeps past the camera.
    loopPts.push(new THREE.Vector3(Math.cos(a) * 11.5, 5.5 + Math.sin(a) * 3.6 + Math.sin(a * 2) * 1.4, Math.sin(a) * 6 - 0.5));
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
  for (let i = 0; i < N; i++) {
    const lane = i % RIB_LANES, k = Math.floor(i / RIB_LANES);
    ribbonU[i] = k / perLane; ribbonLane[i] = (lane - (RIB_LANES - 1) / 2) * 0.98;
    setS(ribbon, i, 0.85, 0.12, 0.85); setC(ribbon, i, base[i]);
    // Position and rotation come from the loop at run time; the arrays
    // hold the u = 0 pose so a debugger reading them sees something sane.
    setP(ribbon, i, ribPos[0], ribPos[1], ribPos[2]);
    setQ(ribbon, i, q.set(ribQuat[0], ribQuat[1], ribQuat[2], ribQuat[3]));
  }

  // K6 mark: the logo's towers, front layer first, then the ones behind;
  // blocks left over rest around the foot of the mark in their own colours.
  const mark = make();
  const cells = [];
  const unit = 0.64, maxH = 18;
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
      setC(mark, i, c);
    } else {
      const a = litterRnd() * Math.PI * 2; const r = 7 + litterRnd() * 6;
      setP(mark, i, Math.cos(a) * r, unit / 2, Math.sin(a) * r);
      setQ(mark, i, q.setFromEuler(e.set(0, litterRnd() * Math.PI, 0)));
      setS(mark, i, unit, unit, unit); setC(mark, i, base[i]);
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
    rank.markTop[i] = clamp01(1 - mark.pos[i * 3 + 1] / 12) * 0.8 + rnd() * 0.2;
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

// Camera path: closed, so the loop's seam is invisible. Times must rise.
const CAMERA = [
  { t: 0.0, pos: [19, 9, 23], look: [0, 3, 0] },
  { t: 3.3, pos: [15, 6, 16], look: [0, 3, 0] },
  { t: 5.4, pos: [10.5, 6, 11.5], look: [0, 4.5, 0] },
  { t: 7.4, pos: [-7.5, 8.5, 10.5], look: [0, 4.5, 0] },
  { t: 9.4, pos: [-14, 8, 18], look: [0, 5.5, 0] },
  { t: 12.4, pos: [-4, 9, 25], look: [0, 1, 0] },
  { t: 14.4, pos: [12, 5, 17], look: [-2, 0.5, 0] },
  { t: 16.6, pos: [6, 4.5, 20], look: [-2, 5.5, -1] },
  { t: 19.4, pos: [-1, 6, 21], look: [0, 5, 0] },
  { t: 22.4, pos: [3, 7, 22], look: [0, 5, 0] },
  { t: LOOP, pos: [19, 9, 23], look: [0, 3, 0] },
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
    scene.fog = new THREE.Fog(0xffffff, 34, 64);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 120);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(9, 16, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    // A cool rim from behind, the second light glass needs to show its edges.
    const rim = new THREE.DirectionalLight(0xdbe8ff, 0.9);
    rim.position.set(-12, 9, -14);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.renderOrder = 0;
    scene.add(ground);

    // Softly bevelled edges catch the highlights: most of what makes a block
    // read as glass rather than plastic.
    const geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.07);
    // Glass: light passes through (transmission tinted by the block's own
    // colour), a polished surface with a clearcoat catches the room and the
    // rim light, and the colour sits in the volume rather than on the skin.
    // Transmission samples what is behind the glass once per frame, so a
    // block does not refract another block; overlaps blend by opacity.
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.1, metalness: 0,
      transmission: 0.5, thickness: 1.2, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.06,
      specularIntensity: 1, envMapIntensity: 2.1,
      transparent: true, opacity: 0.8,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, N);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    // The floor reflection: the same instances mirrored through the ground,
    // faint, seen through a ground that is not quite opaque. It shares the
    // instance buffers, so it costs one draw call and no per-block work.
    const mirror = new THREE.InstancedMesh(geometry, new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: 0.6,
      envMapIntensity: 1.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    }), N);
    mirror.instanceMatrix = mesh.instanceMatrix;
    mirror.scale.y = -1;
    mirror.renderOrder = -1;
    scene.add(mirror);
    ground.material.transparent = true;
    ground.material.opacity = 0.78;
    ground.material.depthWrite = true;

    const K = buildKeyframes();
    const camPos = cameraCurve('pos');
    const camLook = cameraCurve('look');

    // Scratch objects for the per-frame pose blend.
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), p = new THREE.Vector3();
    const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qq = new THREE.Quaternion();
    const sA = new THREE.Vector3(), sB = new THREE.Vector3(), s = new THREE.Vector3();
    const cA = new THREE.Color(), cB = new THREE.Color(), col = new THREE.Color();
    const mat = new THREE.Matrix4();
    const camP = new THREE.Vector3(), camL = new THREE.Vector3();
    const rotQ = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3();

    // Live poses: a keyframe plus what it does while it holds.
    const readPose = (k, i, t, outP, outQ, outS, outC) => {
      const key = K[k];
      outS.set(key.scale[i * 3], key.scale[i * 3 + 1], key.scale[i * 3 + 2]);
      outC.setRGB(key.color[i * 3], key.color[i * 3 + 1], key.color[i * 3 + 2]);
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
        outP.y -= 4.6; outP.applyQuaternion(rotQ); outP.y += 4.6 + Math.sin(t * 0.9) * 0.15;
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
        // A slow wave runs across the field.
        outP.y += (Math.sin(t * 1.4 + outP.x * 0.5) + 1) * 0.12;
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
      for (let i = 0; i < N; i++) {
        if (!move) {
          readPose(holding, i, t, p, qq, s, col);
        } else {
          const start = move.at + K.rank[move.rank][i] * move.stagger;
          const u = clamp01((t - start) / move.dur);
          const w = move.ease(u);
          readPose(move.from, i, t, pA, qA, sA, cA);
          readPose(move.to, i, t, pB, qB, sB, cB);
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
        }
        mat.compose(p, qq, s);
        mesh.setMatrixAt(i, mat);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
        if (mirror.instanceColor !== mesh.instanceColor) mirror.instanceColor = mesh.instanceColor;
      }

      const u = cameraParam(t);
      camPos.getPoint(u, camP);
      camLook.getPoint(u, camL);
      // Fit: pull the camera back along its line of sight until the scene
      // fits the clear area, whatever the window's shape. The close pass
      // over the cube is held to a floor, so the cube is never cropped by
      // the panel or the edge of the clear area.
      camP.sub(camL).multiplyScalar(fit);
      const d = camP.length();
      if (d < minDist) camP.multiplyScalar(minDist / d);
      camP.add(camL);
      camera.position.copy(camP);
      camera.lookAt(camL);
      renderer.render(scene, camera);
    };

    let fit = 1, minDist = 0;
    const resize = () => {
      const host = canvas.parentElement || canvas;
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const rtl = (document.documentElement.getAttribute('dir') || '').toLowerCase() === 'rtl';
      const L = layoutFor(w, h, rtl);
      // Shift the projection so the scene's centre lands in the clear area.
      camera.setViewOffset(w, h, (0.5 - L.cx) * w, (0.5 - L.cy) * h, w, h);
      // The choreography's full spread is about 28 units across and 16 up
      // at the wide keyframes, 24 units from the target. Scale that
      // distance so the whole of it fits the clear rectangle: Tzvi's rule
      // is that nothing is cut off, at any width.
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const needW = (28 * (w / L.visW)) / (2 * tanHalf * camera.aspect);
      const needH = (16 * (h / L.visH)) / (2 * tanHalf);
      fit = Math.max(needW, needH) / 24;
      fit = Math.min(Math.max(fit, 0.85), 6);
      minDist = 21 * fit;
      // The fog and the shadow frustum are authored for fit = 1; a camera
      // pulled back past the fog would see nothing.
      scene.fog.near = 34 * fit; scene.fog.far = 64 * fit;
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
      // Renders n frames back to back and returns the CPU milliseconds per
      // frame (pose blend plus draw submission); the GPU's own time is not
      // included, but on a white scene with one draw call the CPU is the
      // cost that matters.
      window.__blocksHeroBench = (n = 60) => {
        const t1 = performance.now();
        for (let k = 0; k < n; k++) renderAt((k / n) * LOOP);
        return (performance.now() - t1) / n;
      };
      // Renders one frame and returns it as a JPEG data URL: how the
      // fallback poster in public/images/preview-hero is made.
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
      geometry.dispose(); material.dispose(); mirror.material.dispose(); ground.geometry.dispose(); ground.material.dispose();
      pmrem.dispose(); renderer.dispose();
    };
  }, []);

  if (failed) {
    return <img className={className} src="/images/preview-hero/blocks-poster.jpg" alt="" aria-hidden="true" data-testid="home-preview-blocks-still" />;
  }
  return <canvas ref={ref} className={className} aria-hidden="true" data-testid="home-preview-blocks" />;
}
