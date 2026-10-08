"""
Remasterización de la música original de Helbreath (MUSIC/*.wav).

Los originales son de 8 bits (o 16) a 8000-8810 Hz: solo llegan hasta ~4,4 kHz, con el
siseo propio de los 8 bits. No se recompone nada: es la misma grabación, restaurada.

Cadena, en este orden:
  1. bucle sin costuras: se procesa con el final pegado delante y el principio detrás, y
     luego se recorta, para que la cola de la sala y los filtros enlacen al repetir;
  2. reducción de ruido (afftdn de ffmpeg, a la frecuencia original);
  3. remuestreo a 48 kHz;
  4. recuperación de agudos: un excitador de armónicos genera la octava que falta
     (4,4-9 kHz) a partir de la banda alta original, con un nivel que sigue la caída
     natural del espectro;
  5. ecualización suave: un poco más de graves y menos "caja" en 300 Hz;
  6. sala: reverberación por convolución con una respuesta estéreo sintética (1,6 s);
  7. compresión ligera para unir la mezcla;
  8. volumen normalizado (-16 LUFS, pico real -1 dB) y codificación en MP3 a 192 kb/s.

    python remaster_music.py CARPETA_MUSIC SALIDA [pista ...]
"""
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import signal

SR = 48000
TRACKS = ["MainTm"]               # la granja de Aresden; el resto cuando se porten sus mapas
WRAP_S = 4.0


def read_wav(path):
    w = wave.open(path)
    n, sw, sr, ch = w.getnframes(), w.getsampwidth(), w.getframerate(), w.getnchannels()
    raw = w.readframes(n)
    a = np.frombuffer(raw, np.uint8 if sw == 1 else np.int16).astype(np.float64)
    a = (a - 128) / 128 if sw == 1 else a / 32768
    a = a.reshape(-1, ch)
    if ch == 1:
        a = np.repeat(a, 2, axis=1)
    return a, sr


def write_wav(path, a, sr):
    a = np.clip(a, -1, 1)
    w = wave.open(path, "wb")
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((a * 32767).astype("<i2").tobytes())
    w.close()


def ffmpeg(*args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                          check=True, capture_output=True, text=True)


def denoise(a, sr, tmp):
    src, dst = os.path.join(tmp, "in.wav"), os.path.join(tmp, "dn.wav")
    write_wav(src, a, sr)
    # ruido de cuantización de 8 bits ~ -50 dBFS; seguimiento del ruido activado
    ffmpeg("-i", src, "-af", "afftdn=nr=12:nf=-50:tn=1", dst)
    return read_wav(dst)[0]


def band_rms(x, sr, lo, hi):
    sos = signal.butter(6, [lo, hi], "bandpass", fs=sr, output="sos")
    return np.sqrt(np.mean(signal.sosfiltfilt(sos, x, axis=0) ** 2)) + 1e-12


def excite(x, sr, nyq0):
    """Armónicos por encima de la frecuencia de corte original (nyq0)."""
    sos_src = signal.butter(4, [nyq0 * 0.45, nyq0 * 0.95], "bandpass", fs=sr, output="sos")
    band = signal.sosfiltfilt(sos_src, x, axis=0)
    # rectificación (2.º armónico, una octava) + un poco de 3.º, suaves
    gen = np.abs(band) + 0.35 * np.tanh(3 * band) ** 3
    sos_hi = signal.butter(8, nyq0 * 1.02, "highpass", fs=sr, output="sos")
    sos_lo = signal.butter(4, 15000, "lowpass", fs=sr, output="sos")
    gen = signal.sosfiltfilt(sos_lo, signal.sosfiltfilt(sos_hi, gen, axis=0), axis=0)
    # nivel: la octava nueva queda ~9 dB por debajo de la última octava original
    ref = band_rms(x, sr, nyq0 * 0.5, nyq0 * 0.95)
    have = band_rms(gen, sr, nyq0 * 1.05, nyq0 * 2)
    gen *= (ref * 10 ** (-9 / 20)) / have
    return x + gen


def biquad_shelf(x, sr, f0, gain_db, kind):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / sr; S = 1
    alpha = np.sin(w0) / 2 * np.sqrt((A + 1 / A) * (1 / S - 1) + 2)
    c = np.cos(w0)
    if kind == "low":
        b = [A * ((A + 1) - (A - 1) * c + 2 * np.sqrt(A) * alpha), 2 * A * ((A - 1) - (A + 1) * c),
             A * ((A + 1) - (A - 1) * c - 2 * np.sqrt(A) * alpha)]
        a = [(A + 1) + (A - 1) * c + 2 * np.sqrt(A) * alpha, -2 * ((A - 1) + (A + 1) * c),
             (A + 1) + (A - 1) * c - 2 * np.sqrt(A) * alpha]
    return signal.lfilter(b, a, x, axis=0)


def peaking(x, sr, f0, gain_db, q):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / sr; alpha = np.sin(w0) / (2 * q)
    b = [1 + alpha * A, -2 * np.cos(w0), 1 - alpha * A]
    a = [1 + alpha / A, -2 * np.cos(w0), 1 - alpha / A]
    return signal.lfilter(b, a, x, axis=0)


def reverb_ir(sr, rt60=1.6, predelay=0.022, seed=7):
    rng = np.random.default_rng(seed)
    n = int(sr * rt60 * 1.2)
    t = np.arange(n) / sr
    env = np.exp(-6.9 * t / rt60)
    ir = rng.standard_normal((n, 2)) * env[:, None]
    # la cola se oscurece con el tiempo: mezcla de versión filtrada que gana peso
    dark = signal.sosfilt(signal.butter(2, 2500, "lowpass", fs=sr, output="sos"), ir, axis=0)
    k = np.clip(t / rt60, 0, 1)[:, None]
    ir = ir * (1 - k) + dark * k * 1.6
    ir = signal.sosfilt(signal.butter(2, 180, "highpass", fs=sr, output="sos"), ir, axis=0)
    # primeras reflexiones
    for d, g, side in [(0.011, 0.5, 0), (0.017, 0.45, 1), (0.029, 0.35, 0), (0.037, 0.3, 1)]:
        ir[int(d * sr), side] += g * 6
    ir = np.concatenate([np.zeros((int(predelay * sr), 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))


def compress(x, sr, thr_db=-20, ratio=2.0, att=0.015, rel=0.25):
    level = np.sqrt(np.mean(x ** 2, axis=1))
    a_a, a_r = np.exp(-1 / (att * sr)), np.exp(-1 / (rel * sr))
    env = np.empty_like(level); e = 0.0
    # seguidor de envolvente (bucle en bloques de 64 muestras para ir rápido)
    blk = 64
    lv = level[: len(level) // blk * blk].reshape(-1, blk).max(axis=1)
    out = np.empty_like(lv)
    aa, ar = a_a ** blk, a_r ** blk
    for i, v in enumerate(lv):
        e = aa * e + (1 - aa) * v if v > e else ar * e + (1 - ar) * v
        out[i] = e
    env = np.repeat(out, blk)
    env = np.concatenate([env, np.full(len(level) - len(env), out[-1] if len(out) else 0)])
    db = 20 * np.log10(env + 1e-9)
    gain_db = np.where(db > thr_db, (thr_db - db) * (1 - 1 / ratio), 0)
    gain = 10 ** (signal.savgol_filter(gain_db, 2049, 2) / 20) if len(gain_db) > 2049 else 10 ** (gain_db / 20)
    return x * gain[:, None]


def loudnorm_encode(a, sr, out_mp3, tmp):
    src = os.path.join(tmp, "pre.wav")
    write_wav(src, a / max(1.0, np.abs(a).max()), sr)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    af = ("loudnorm=I=-16:TP=-1:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:"
          "measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}").format(**js)
    ffmpeg("-i", src, "-af", af + ",aresample=48000", "-c:a", "libmp3lame", "-b:a", "192k", out_mp3)


def remaster(path, out_mp3, out_wav=None):
    x, sr0 = read_wav(path)
    n0 = len(x)
    wrap = int(WRAP_S * sr0)
    xw = np.concatenate([x[-wrap:], x, x[:wrap]])          # bucle sin costuras
    with tempfile.TemporaryDirectory() as tmp:
        xw = denoise(xw, sr0, tmp)
        xw = xw - xw.mean(axis=0)
        g = np.gcd(SR, sr0)
        y = signal.resample_poly(xw, SR // g, sr0 // g, axis=0)
        y = excite(y, SR, sr0 / 2)
        y = biquad_shelf(y, SR, 110, 2.5, "low")
        y = peaking(y, SR, 320, -1.5, 0.9)
        y = peaking(y, SR, 2600, 1.0, 1.0)
        # sala
        ir = reverb_ir(SR)
        wet = np.stack([signal.fftconvolve(y[:, c], ir[:, c])[: len(y)] for c in range(2)], axis=1)
        wet *= np.sqrt(np.mean(y ** 2)) / (np.sqrt(np.mean(wet ** 2)) + 1e-12)
        y = y + 0.22 * wet
        y = compress(y, SR)
        # recorte al bucle original
        s = int(round(wrap * SR / sr0)); e = s + int(round(n0 * SR / sr0))
        y = y[s:e]
        if out_wav:
            write_wav(out_wav, y / max(1.0, np.abs(y).max()), SR)
        loudnorm_encode(y, SR, out_mp3, tmp)
    return x, sr0


def main():
    src, out = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or TRACKS
    os.makedirs(out, exist_ok=True)
    files = {f.lower(): f for f in os.listdir(src)}
    for t in names:
        real = files.get(t.lower() + ".wav")
        if not real:
            print("falta", t); continue
        print("remasterizando", t, "...", flush=True)
        remaster(os.path.join(src, real), os.path.join(out, t.lower() + ".remaster.mp3"))
    print("listo")


if __name__ == "__main__":
    main()
