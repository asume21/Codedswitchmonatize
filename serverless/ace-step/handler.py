import base64
import os
import time
import uuid
from pathlib import Path

import runpod
import numpy as np
import soundfile as sf

PIPELINE = None
OUTPUT_DIR = Path(os.getenv("ACE_STEP_OUTPUT_DIR", "/tmp/ace-step-output"))
CHECKPOINT_DIR = os.getenv("ACE_STEP_CHECKPOINT_DIR", "/runpod-volume/checkpoints")
EXTRA_GENERATION_SECONDS = float(os.getenv("ACE_STEP_EXTRA_GENERATION_SECONDS", "1.5"))


def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def get_pipeline():
    global PIPELINE
    if PIPELINE is not None:
        return PIPELINE

    from acestep.pipeline_ace_step import ACEStepPipeline

    cpu_offload = _as_bool(os.getenv("ACE_STEP_CPU_OFFLOAD", "false"))
    bf16 = _as_bool(os.getenv("ACE_STEP_BF16", "true"), True)
    Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)

    print(f"[ace-step-serverless] loading checkpoint_dir={CHECKPOINT_DIR} cpu_offload={cpu_offload}")
    PIPELINE = ACEStepPipeline(
        checkpoint_dir=CHECKPOINT_DIR,
        dtype="bfloat16" if bf16 else "float32",
        cpu_offload=cpu_offload,
    )
    print("[ace-step-serverless] model loaded")
    return PIPELINE


def normalize_wav_duration(path: Path, target_duration_s: float) -> float:
    audio, sample_rate = sf.read(str(path), always_2d=True)
    target_samples = max(1, int(round(target_duration_s * sample_rate)))
    current_samples = audio.shape[0]

    if current_samples > target_samples:
        audio = audio[:target_samples]
        fade_samples = min(int(sample_rate * 0.05), target_samples)
        if fade_samples > 0:
            fade = np.linspace(1.0, 0.0, fade_samples, dtype=audio.dtype)
            audio[-fade_samples:] *= fade[:, None]
    elif current_samples < target_samples:
        pad = np.zeros((target_samples - current_samples, audio.shape[1]), dtype=audio.dtype)
        audio = np.concatenate([audio, pad], axis=0)

    sf.write(str(path), audio, sample_rate)
    return audio.shape[0] / sample_rate


def handler(event):
    payload = event.get("input") or {}
    prompt = payload.get("prompt")
    if not prompt:
        raise ValueError("Missing required input.prompt")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    job_id = event.get("id") or uuid.uuid4().hex
    seed = payload.get("seed")
    if seed is None:
        seed = int(time.time()) % (2**31)

    out_path = OUTPUT_DIR / f"{job_id}.wav"
    t0 = time.time()
    requested_duration = float(payload.get("audio_duration", 30.0))
    generation_duration = requested_duration + EXTRA_GENERATION_SECONDS

    pipeline = get_pipeline()
    pipeline(
        audio_duration=generation_duration,
        prompt=prompt,
        lyrics=payload.get("lyrics") or "",
        infer_step=int(payload.get("infer_step", 25)),
        guidance_scale=float(payload.get("guidance_scale", 15.0)),
        scheduler_type=payload.get("scheduler_type", "euler"),
        cfg_type=payload.get("cfg_type", "apg"),
        omega_scale=float(payload.get("omega_scale", 10.0)),
        manual_seeds=[int(seed)],
        guidance_interval=float(payload.get("guidance_interval", 0.5)),
        guidance_interval_decay=float(payload.get("guidance_interval_decay", 0.0)),
        min_guidance_scale=float(payload.get("min_guidance_scale", 3.0)),
        use_erg_tag=bool(payload.get("use_erg_tag", True)),
        use_erg_lyric=bool(payload.get("use_erg_lyric", bool(payload.get("lyrics")))),
        use_erg_diffusion=bool(payload.get("use_erg_diffusion", True)),
        oss_steps=None,
        guidance_scale_text=0.0,
        guidance_scale_lyric=0.0,
        save_path=str(out_path),
    )

    audio_duration = normalize_wav_duration(out_path, requested_duration)
    audio_bytes = out_path.read_bytes()
    return {
        "format": "wav",
        "seed": int(seed),
        "duration_s": round(audio_duration, 2),
        "generation_s": round(time.time() - t0, 2),
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
