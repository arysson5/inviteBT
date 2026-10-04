#!/usr/bin/env python3
"""Cama sonora sintética, sem amostra de terceiros, alinhada ao reel de 43.8s."""

import math
import random
import struct
import wave

SR = 44100
DUR = 43.4
N = int(SR * DUR)
buf = [0.0] * N
rnd = random.Random(11)
BPM = 100.0
BEAT = 60.0 / BPM


def add(i, v):
    if 0 <= i < N:
        buf[i] += v


def add_tone(t0, freq, dur, amp, decay):
    start = int(t0 * SR)
    samples = int(dur * SR)
    for n in range(samples):
        t = n / SR
        env = math.exp(-t / decay) * (1 - math.exp(-t / 0.008))
        s = math.sin(2 * math.pi * freq * t) + 0.28 * math.sin(2 * math.pi * freq * 2 * t)
        add(start + n, s * env * amp)


CHORDS = [
    (220.00, 261.63, 329.63),
    (174.61, 220.00, 261.63),
    (130.81, 164.81, 196.00),
    (196.00, 246.94, 293.66),
]

n_beats = int(DUR / BEAT) + 1
for b in range(n_beats):
    t0 = b * BEAT
    if t0 >= DUR:
        break
    chord = CHORDS[(b // 4) % 4]
    if b % 2 == 0:
        for freq in chord:
            add_tone(t0, freq, 0.85, 0.055, 0.26)
    else:
        add_tone(t0, chord[2] * 2, 0.35, 0.03, 0.16)

    if t0 >= 31.7 and t0 < 37.0 and b % 2 == 0:
        add_tone(t0, chord[1] * 2, 0.45, 0.045, 0.18)

    if b % 4 in (0, 2):
        samples = int(0.2 * SR)
        start = int(t0 * SR)
        phase = 0.0
        for n in range(samples):
            t = n / SR
            freq = 86 * math.exp(-t * 16) + 40
            phase += 2 * math.pi * freq / SR
            env = math.exp(-t * 14)
            add(start + n, math.sin(phase) * env * 0.48)

    if b % 4 == 2:
        samples = int(0.1 * SR)
        start = int(t0 * SR)
        for n in range(samples):
            t = n / SR
            env = math.exp(-t * 30)
            add(start + n, (rnd.random() * 2 - 1) * env * 0.12)

    samples = int(0.035 * SR)
    start = int(t0 * SR)
    for n in range(samples):
        t = n / SR
        env = math.exp(-t * 90)
        add(start + n, (rnd.random() * 2 - 1) * env * 0.035)

CUTS = [1.65, 3.15, 4.55, 6.7, 9.4, 11.9, 14.3, 16.7, 18.9, 21.8, 24.2, 26.9, 29.2, 31.7, 34.4, 37.0, 39.16]
for cut in CUTS:
    samples = int(0.16 * SR)
    start = int(max(0, cut - 0.02) * SR)
    for n in range(samples):
        t = n / SR
        env = math.sin(math.pi * min(1.0, t / 0.16))
        freq = 420 + t * 1600
        add(start + n, math.sin(2 * math.pi * freq * t) * env * 0.035)

swell_start = int(39.16 * SR)
for n in range(int(3.6 * SR)):
    t = n / SR
    env = min(1.0, t / 0.35) * (1 - min(1.0, max(0.0, t - 2.9) / 0.7))
    s = (
        math.sin(2 * math.pi * 220 * t)
        + math.sin(2 * math.pi * 277.18 * t)
        + math.sin(2 * math.pi * 329.63 * t)
    ) / 3
    add(swell_start + n, s * env * 0.1)

peak = max(abs(x) for x in buf) or 1.0
scale = 0.9 / peak

with wave.open("/tmp/reel-bed.wav", "w") as handle:
    handle.setnchannels(1)
    handle.setsampwidth(2)
    handle.setframerate(SR)
    chunk = []
    for i, sample in enumerate(buf):
        t = i / SR
        fade = 1.0
        if t < 0.06:
            fade = t / 0.06
        if t > DUR - 0.45:
            fade = max(0.0, (DUR - t) / 0.45)
        value = int(sample * scale * fade * 32767)
        value = max(-32767, min(32767, value))
        chunk.append(struct.pack("<h", value))
        if len(chunk) >= SR:
            handle.writeframes(b"".join(chunk))
            chunk = []
    if chunk:
        handle.writeframes(b"".join(chunk))

print(f"wav ok peak={peak:.3f} dur={DUR}")
