import base64
import os
import time
import uuid
from pathlib import Path

import runpod
import numpy as np
import soundfile as sf

HANDLER = None
OUTPUT_DIR = Path(os.getenv("ACE_STEP_OUTPUT_DIR", "/tmp/ace-step-output"))
CHECKPOINT_DIR = os.getenv("ACE_STEP_CHECKPOINT_DIR", "/runpod-volume/checkpoints")
MODEL_CONFIG = os.getenv("ACE_STEP_MODEL_CONFIG", "acestep-v15-base")
EXTRA_GENERATION_SECONDS = float(os.getenv("ACE_STEP_EXTRA_GENERATION_SECONDS", "1.5"))
DEVICE = os.getenv("ACE_STEP_DEVICE", "cuda")

VALID_TRACK_NAMES = {
    "vocals", "backing_vocals", "drums", "bass", "guitar",
    "keyboard", "percussion", "strings", "synth", "fx", "brass", "woodwinds",
}


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).lower() in {"1", "true", "yes", "on"}


def get_handler():
    global HANDLER
    if HANDLER is not None:
        return HANDLER

    from acestep.acestep_v15_pipeline import AceStepHandler

    offload = _as_bool(os.getenv("ACE_STEP_CPU_OFFLOAD", "false"))
    bf16 = _as_bool(os.getenv("ACE_STEP_BF16", "true"), True)

    Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)

    print(f"[ace-step] loading config={MODEL_CONFIG} device={DEVICE} offload={offload} bf16={bf16}")
    HANDLER = AceStepHandler()
    HANDLER.initialize_service(
        project_root=CHECKPOINT_DIR,
        config_path=MODEL_CONFIG,
        device=DEVICE,
        offload_to_cpu=offload,
        torch_dtype="bfloat16" if bf16 else "float32",
    )
    print("[ace-step] model loaded")
    return HANDLER


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

    task_type = payload.get("task_type", "text2music")
    track_name = payload.get("track_name") or None
    bpm = payload.get("bpm") or None

    if task_type == "lego" and track_name and track_name not in VALID_TRACK_NAMES:
        raise ValueError(
            f"Invalid track_name '{track_name}'. Must be one of: {sorted(VALID_TRACK_NAMES)}"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    job_id = event.get("id") or uuid.uuid4().hex
    seed = payload.get("seed")
    if seed is None:
        seed = int(time.time()) % (2**31)

    out_path = OUTPUT_DIR / f"{job_id}.wav"
    t0 = time.time()
    requested_duration = float(payload.get("audio_duration", 30.0))
    generation_duration = requested_duration + EXTRA_GENERATION_SECONDS

    lyrics = payload.get("lyrics") or ""

    ace = get_handler()
    ace.service_generate(
        captions=[prompt],
        lyrics=[lyrics],
        audio_duration=generation_duration,
        task_type=task_type,
        track_name=track_name,
        infer_steps=int(payload.get("infer_step", 25)),
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
        bpm=int(bpm) if bpm is not None else None,
        save_path=str(out_path),
    )

    if not out_path.exists():
        raise RuntimeError(f"ACE-Step generation produced no output at {out_path}")

    audio_duration = normalize_wav_duration(out_path, requested_duration)
    audio_bytes = out_path.read_bytes()

    result = {
        "format": "wav",
        "seed": int(seed),
        "duration_s": round(audio_duration, 2),
        "generation_s": round(time.time() - t0, 2),
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
    }
    if task_type != "text2music":
        result["task_type"] = task_type
    if track_name:
        result["track_name"] = track_name
    return result


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
