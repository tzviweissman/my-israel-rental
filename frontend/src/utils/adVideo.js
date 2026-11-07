// A canvas animation as an MP4, made in the browser for free. Frames are encoded one by one, not recorded
// live, so a slow phone makes it slower but never makes it stutter.
const FPS = 30;
const BITRATE = 8000000;
// High, then Main, then Baseline: all at level 4, which covers a 1080x1920 status.
const CODECS = ['avc1.640028', 'avc1.4D0028', 'avc1.42E028'];

async function pickConfig(width, height) {
  if (!window.VideoEncoder) return null;
  for (const codec of CODECS) {
    const config = { codec, width, height, bitrate: BITRATE, framerate: FPS, avc: { format: 'avc' } };
    // eslint-disable-next-line no-await-in-loop
    const ok = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (ok?.supported) return config;
  }
  return null;
}

// paint(seconds) draws that moment on the canvas. Throws when this browser cannot make an MP4.
// ponytail: no fallback for browsers without H.264 in WebCodecs; the owner is told to use another. Add server-side ffmpeg if owners hit it.
export async function adVideo(canvas, paint, seconds, onProgress = () => {}) {
  const config = await pickConfig(canvas.width, canvas.height);
  if (!config) throw new Error('This browser cannot make an MP4');
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: canvas.width, height: canvas.height, frameRate: FPS },
    fastStart: 'in-memory',
  });
  let failed = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  encoder.configure(config);
  const total = Math.round(seconds * FPS);
  try {
    for (let i = 0; i < total; i += 1) {
      if (failed) throw failed;
      paint(i / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: i % 60 === 0 });
      frame.close();
      onProgress(Math.round((i / total) * 100));
      // Let the page breathe and the encoder catch up.
      // eslint-disable-next-line no-await-in-loop
      do { await new Promise((r) => { setTimeout(r); }); } while (encoder.encodeQueueSize > 4);
    }
    await encoder.flush();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
  if (failed) throw failed;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
