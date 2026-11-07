"""The film's sound, made in code: a soft chord at 100 beats a minute, a low swell where each colour pours out,
a bell on the logo. Scene changes land on the beat (3 seconds = 5 beats). Standard library only.
    python sound.py out.wav
"""
import math
import random
import struct
import sys
import wave

RATE, DUR = 44100, 22.5
TURNS = [2.3 + 3 * i for i in range(6)]  # where each colour starts to pour, 0.7s before its scene
CHORDS = [[220.0, 277.18, 329.63], [196.0, 246.94, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]]
random.seed(7)
n = int(RATE * DUR)
out = [0.0] * n
for i in range(n):
    t = i / RATE
    chord = CHORDS[int(t // 3) % 4]
    fade = min(1.0, t / 1.5) * min(1.0, (DUR - t) / 2.0)
    out[i] += 0.07 * fade * sum(math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t) for f in chord) / 3
    beat = (t % 0.6) / 0.6
    out[i] += 0.035 * fade * math.exp(-6 * beat) * math.sin(2 * math.pi * 110 * t)
for start in TURNS:
    for i in range(int(start * RATE), min(n, int((start + 0.9) * RATE))):
        p = i / RATE - start
        out[i] += 0.12 * math.sin(math.pi * p / 0.9) ** 2 * math.sin(2 * math.pi * (70 + 60 * p) * (i / RATE))
BELL = 18.2
for i in range(int(BELL * RATE), n):
    p = i / RATE - BELL
    out[i] += 0.14 * math.exp(-1.6 * p) * (math.sin(2 * math.pi * 880 * p) + 0.5 * math.sin(2 * math.pi * 1320 * p))
top = max(abs(x) for x in out)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(x / top * 0.8 * 32767)) for x in out))
