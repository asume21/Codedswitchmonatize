import base64
import os
import time
import uuid
from pathlib import Path

import runpod
import numpy as np
import soundfile as sf

DIT_HANDLER = None
OUTPUT_DIR = Path(os.getenv("ACE_STEP_OUTPUT_DIR", "/tmp/ace-step-output"))
CHECKPOINT_DIR = os.getenv("ACE_STEP_CHECKPOINT_DIR", "/runpod-volume/checkpoints")
MODEL_CONFIG = os.getenv("ACE_STEP_MODEL_CONFIG", "acestep-v15-base")
DEVICE = os.getenv("ACE_STEP_DEVICE", "cuda")
EXTRA_GENERATION_SECONDS = float(os.getenv("ACE_STEP_EXTRA_GENERATION_SECONDS", "1.5"))

VALID_TRACK_NAMES = {
    "vocals", "backing_vocals", "drums", "bass", "guitar",
    "keyboard", "percussion", "strings", "synth", "fx", "brass", "woodwinds",
}


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).lower() in {"1", "true", "yes", "on"}


def get_dit_handler():
    global DIT_HANDLER
    if DIT_HANDLER is not None:
        return DIT_HANDLER

    from acestep.handler import AceStepHandler

    offload = _as_bool(os.getenv("ACE_STEP_CPU_OFFLOAD", "false"))
    Path(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)

    print(f"[ace-step] loading config={MODEL_CONFIG} device={DEVICE} offload={offload}")
    ace = AceStepHandler()
    init_status, ok = ace.initialize_service(
        project_root=CHECKPOINT_DIR,
        config_path=MODEL_CONFIG,
        device=DEVICE,
        offload_to_cpu=offload,
        prefer_source="huggingface",
    )
    if not ok:
        raise RuntimeError(f"AceStepHandler.initialize_service failed: {init_status}")

    print(f"[ace-step] model loaded: {init_status}")
    DIT_HANDLER = ace
    return DIT_HANDLER


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


def build_instruction(task_type: str, track_name: str | None) -> str:
    from acestep.constants import TASK_INSTRUCTIONS, DEFAULT_DIT_INSTRUCTION
    template = TASK_INSTRUCTIONS.get(task_type, DEFAULT_DIT_INSTRUCTION)
    if "{TRACK_NAME}" in template and track_name:
        return template.format(TRACK_NAME=track_name)
    return template


def handler(event):
    # Top-level guard: convert any Python-side failure into an explicit raise
    # with full type/message so it lands in RunPod's `error` field instead of
    # a silent COMPLETED+null. SIGKILLs (OOM-killer, container reset) still
    # escape this — but the [ace-step] log lines below let us see how far we
    # got before death.
    try:
        return _run_generation(event)
    except Exception as exc:
        is_oom = (
            "out of memory" in str(exc).lower()
            or "CUDA out of memory" in str(exc)
            or "CUBLAS" in str(exc).upper()
        )
        print(f"[ace-step] handler error: {type(exc).__name__}: {exc} (is_oom={is_oom})", flush=True)

        if is_oom and not _as_bool(os.getenv("ACE_STEP_CPU_OFFLOAD"), default=False):
            print("[ace-step] OOM detected; retrying once with cpu_offload=true", flush=True)
            os.environ["ACE_STEP_CPU_OFFLOAD"] = "true"
            global DIT_HANDLER
            DIT_HANDLER = None  # force model re-init with offload enabled
            try:
                return _run_generation(event)
            except Exception as exc2:
                print(f"[ace-step] OOM retry also failed: {type(exc2).__name__}: {exc2}", flush=True)
                raise RuntimeError(f"OOM retry failed: {type(exc2).__name__}: {exc2}") from exc2
        raise


def _run_generation(event):
    from acestep.inference import generate_music, GenerationParams, GenerationConfig

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

    t0 = time.time()
    requested_duration = float(payload.get("audio_duration", 30.0))
    generation_duration = requested_duration + EXTRA_GENERATION_SECONDS
    lyrics = payload.get("lyrics") or ""
    infer_steps = int(payload.get("infer_step", 32 if "turbo" not in MODEL_CONFIG else 8))
    guidance_scale = float(payload.get("guidance_scale", 7.0))
    use_adg = "turbo" not in MODEL_CONFIG  # ADG only works on the base model

    instruction = build_instruction(task_type, track_name)

    params = GenerationParams(
        task_type=task_type,
        caption=prompt,
        lyrics=lyrics,
        duration=generation_duration,
        bpm=int(bpm) if bpm is not None else None,
        seed=seed,
        instruction=instruction,
        inference_steps=infer_steps,
        guidance_scale=guidance_scale,
        use_adg=use_adg,
        # Disable LM chain-of-thought — no LLM loaded in serverless
        thinking=False,
        use_cot_metas=False,
        use_cot_caption=False,
        use_cot_language=False,
    )

    config = GenerationConfig(
        batch_size=1,
        audio_format="wav",
        seeds=[seed],
    )

    print(f"[ace-step] generating job={job_id} duration={generation_duration:.1f}s steps={infer_steps} seed={seed}", flush=True)
    ace = get_dit_handler()
    print(f"[ace-step] model ready (after {time.time() - t0:.1f}s); starting inference", flush=True)
    result = generate_music(
        dit_handler=ace,
        llm_handler=None,
        params=params,
        config=config,
        save_dir=str(OUTPUT_DIR),
    )
    print(f"[ace-step] inference done (after {time.time() - t0:.1f}s); success={result.success}", flush=True)

    if not result.success or not result.audios:
        raise RuntimeError(result.error or "ACE-Step generation produced no audio")

    audio_path = Path(result.audios[0]["path"])
    if not audio_path.exists():
        raise RuntimeError(f"Generated audio file not found at {audio_path}")

    audio_duration = normalize_wav_duration(audio_path, requested_duration)
    audio_bytes = audio_path.read_bytes()

    # Clean up temp file — the TS layer writes its own copy from base64
    try:
        audio_path.unlink(missing_ok=True)
    except Exception:
        pass

    out = {
        "format": "wav",
        "seed": int(seed),
        "duration_s": round(audio_duration, 2),
        "generation_s": round(time.time() - t0, 2),
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
    }
    if task_type != "text2music":
        out["task_type"] = task_type
    if track_name:
        out["track_name"] = track_name
    return out


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
