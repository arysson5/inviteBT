#!/usr/bin/env python3
"""Base contínua, sem percussão e sem whoosh. Ataque suave para não estalar."""

import math
import struct
import wave

SR = 44100
DUR = 42.2
N = int(SR * DUR)
buf = [0.0] * N


def add(i, v):
    if 0 <= i < N:
        buf[i] += v


def envelope(t, dur, attack):
    if t < 0 or t > dur:
        return 0.0
    if t < attack:
        return 0.5 - 0.5 * math.cos(math.pi * t / attack)
    if t > dur - attack:
        return 0.5 - 0.5 * math.cos(math.pi * (dur - t) / attack)
    return 1.0


def add_pad(t0, dur, freqs, amp, attack=0.7):
    samples = int(dur * SR)
    start = int(t0 * SR)
    for n in range(samples):
        t = n / SR
        env = envelope(t, dur, attack)
        sample = 0.0
        for freq in freqs:
            sample += math.sin(2 * math.pi * freq * t)
            sample += 0.22 * math.sin(2 * math.pi * freq * 2 * t + 0.4)
        sample /= len(freqs) * 1.22
        add(start + n, sample * env * amp)


def add_note(t0, freq, dur, amp):
    attack = 0.11
    samples = int(dur * SR)
    start = int(max(0, t0) * SR)
    for n in range(samples):
        if start + n >= N:
            break
        t = n / SR
        env = envelope(t, dur, attack) * math.exp(-t / 1.35)
        sample = math.sin(2 * math.pi * freq * t)
        sample += 0.18 * math.sin(2 * math.pi * freq * 2 * t)
        add(start + n, sample * env * amp)


CHORDS = [
    (220.00, 261.63, 329.63),
    (174.61, 220.00, 261.63),
    (130.81, 164.81, 196.00),
    (196.00, 246.94, 293.66),
]

# Acordes se cruzam. Sem batida, sem ruído.
step = 7.2
overlap = 1.1
t = 0.0
index = 0
while t < DUR:
    add_pad(t, step + overlap, CHORDS[index % 4], 0.11, attack=0.85)
    t += step
    index += 1

# Melodia espaçada, ataque longo o bastante para não "pular".
MELODY = [329.63, 392.00, 440.00, 392.00, 349.23, 329.63, 293.66, 329.63]
note_every = 1.45
for i, freq in enumerate(MELODY * 6):
    start = 0.8 + i * note_every
    if start > DUR - 1.2:
        break
    add_note(start, freq, 1.7, 0.03)
    if i % 2 == 0:
        add_note(start + 0.02, freq / 2, 2.1, 0.03)

peak = max(abs(x) for x in buf) or 1.0
scale = 0.86 / peak

with wave.open("/tmp/reel-bed.wav", "w") as handle:
    handle.setnchannels(1)
    handle.setsampwidth(2)
    handle.setframerate(SR)
    chunk = []
    for i, sample in enumerate(buf):
        time = i / SR
        fade = 1.0
        if time < 0.8:
            fade = 0.5 - 0.5 * math.cos(math.pi * time / 0.8)
        if time > DUR - 1.1:
            fade *= max(0.0, (DUR - time) / 1.1)
        value = int(sample * scale * fade * 32767)
        value = max(-32767, min(32767, value))
        chunk.append(struct.pack("<h", value))
        if len(chunk) >= SR:
            handle.writeframes(b"".join(chunk))
            chunk = []
    if chunk:
        handle.writeframes(b"".join(chunk))

print(f"wav ok peak={peak:.3f} dur={DUR}")
