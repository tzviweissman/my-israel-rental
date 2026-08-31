/**
 * The GPS stripper actually removes GPS.
 *
 * Built against a JPEG carrying a REAL EXIF APP1 segment with a real
 * GPS IFD, constructed here rather than mocked, because the thing being
 * tested is byte-level container surgery and a mock would only prove the
 * mock parses.
 *
 * The assertion that matters is the negative one: after stripping, the
 * GPS coordinate bytes must not appear ANYWHERE in the output. Checking
 * that the APP1 marker is gone is not enough - a stripper that dropped
 * the marker but left the payload would pass that and still publish the
 * address.
 *
 * Usage: node scripts/test-strip-exif.mjs
 */
import { stripImageMetadata, canStripLocally } from '../frontend/src/utils/stripImageMetadata.js';

const failures = [];
const note = (m) => console.log('  ' + m);

// --- build a JPEG with a genuine EXIF GPS block ---------------------------

/** A tiny but structurally valid EXIF APP1 payload with a GPS IFD. */
function exifWithGps(lat = 31, lon = 35) {
  const parts = [];
  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

  const header = Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    Buffer.from('MM\0\x2a', 'latin1'),   // big-endian TIFF
    u32(8),                              // offset of IFD0
  ]);
  // IFD0 with one entry: GPSInfoIFDPointer (0x8825)
  const ifd0 = Buffer.concat([
    u16(1),
    u16(0x8825), u16(4), u32(1), u32(26),
    u32(0),
  ]);
  // GPS IFD: latitude ref + a rational carrying our marker values
  const gps = Buffer.concat([
    u16(2),
    u16(0x0001), u16(2), u32(2), Buffer.from('N\0\0\0', 'latin1'),
    u16(0x0002), u16(5), u32(1), u32(64),
    u32(0),
    u32(lat), u32(1),                    // the coordinate bytes we hunt for
    u32(lon), u32(1),
  ]);
  parts.push(header, ifd0, gps);
  return Buffer.concat(parts);
}

function jpegWithExif() {
  const exif = exifWithGps(0x4C41545F, 0x4C4F4E5F);   // "LAT_" / "LON_"
  const app1Len = exif.length + 2;
  const chunks = [
    Buffer.from([0xff, 0xd8]),                                  // SOI
    Buffer.from([0xff, 0xe0, 0x00, 0x10]),                      // APP0 JFIF
    Buffer.from('JFIF\0\x01\x02\x00\x00\x01\x00\x01\x00\x00', 'latin1'),
    Buffer.from([0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff]),
    exif,                                                       // APP1 EXIF
    Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]),                // DQT
    Buffer.alloc(64, 0x10),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), // SOS
    Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]),                      // scan data
    Buffer.from([0xff, 0xd9]),                                  // EOI
  ];
  return Buffer.concat(chunks);
}

const asFile = (buf, name, type) => new File([buf], name, { type });
const bytesOf = async (f) => Buffer.from(await f.arrayBuffer());
const contains = (hay, needle) => hay.includes(Buffer.from(needle, 'latin1'));

// --- run ------------------------------------------------------------------

const original = jpegWithExif();
note(`built a JPEG of ${original.length} bytes with a real APP1 EXIF + GPS IFD`);

if (!contains(original, 'Exif')) failures.push('fixture is wrong: no Exif marker in the input');
if (!contains(original, 'LAT_')) failures.push('fixture is wrong: GPS payload not in the input');

const out = await stripImageMetadata(asFile(original, 'sofa.jpg', 'image/jpeg'));
const stripped = await bytesOf(out);
note(`after stripping: ${stripped.length} bytes`);

// The assertion that matters.
if (contains(stripped, 'LAT_') || contains(stripped, 'LON_')) {
  failures.push('THE GPS COORDINATES SURVIVED - the address is still in the file');
} else {
  note('GPS coordinate bytes are gone');
}
if (contains(stripped, 'Exif')) failures.push('the EXIF header survived');

// It must still be a usable JPEG: SOI, the scan, and EOI intact.
if (!(stripped[0] === 0xff && stripped[1] === 0xd8)) failures.push('output is not a JPEG (no SOI)');
if (!contains(stripped, '\xff\xda')) failures.push('the scan segment was destroyed');
if (!contains(stripped, '\xaa\xbb\xcc\xdd')) failures.push('image data was lost');
if (!(stripped[stripped.length - 2] === 0xff && stripped[stripped.length - 1] === 0xd9)) {
  failures.push('output has no EOI');
}
// JFIF must survive - dropping it can change how decoders read the file.
if (!contains(stripped, 'JFIF')) failures.push('APP0/JFIF was removed; only metadata should go');
note('SOI, JFIF, scan data and EOI all intact');

// --- formats it must leave alone -----------------------------------------

const gif = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(16, 7)]);
const sameGif = await stripImageMetadata(asFile(gif, 'a.gif', 'image/gif'));
if (Buffer.compare(await bytesOf(sameGif), gif) !== 0) failures.push('GIF was modified; it has no EXIF to remove');

const heic = Buffer.alloc(64, 3);
const sameHeic = await stripImageMetadata(asFile(heic, 'IMG_1.heic', 'image/heic'));
if (Buffer.compare(await bytesOf(sameHeic), heic) !== 0) {
  failures.push('HEIC was rewritten - this module must not touch ISOBMFF');
}
if (canStripLocally('image/heic')) failures.push('canStripLocally claims HEIC, which it cannot do');
if (!canStripLocally('image/jpeg')) failures.push('canStripLocally rejects JPEG');
note('GIF and HEIC passed through untouched, and canStripLocally is honest about HEIC');

// --- it must never throw --------------------------------------------------

for (const [label, buf, type] of [
  ['empty', Buffer.alloc(0), 'image/jpeg'],
  ['truncated', original.subarray(0, 12), 'image/jpeg'],
  ['garbage', Buffer.alloc(40, 0xff), 'image/jpeg'],
  ['png-claim-on-jpeg-bytes', original, 'image/png'],
]) {
  try {
    const r = await stripImageMetadata(asFile(buf, 'x', type));
    if (!r) failures.push(`${label}: returned nothing`);
  } catch (e) {
    failures.push(`${label}: threw ${e.message} - an upload must not fail over metadata`);
  }
}
note('malformed input returns the original rather than throwing');

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall exif-stripping checks passed');
