"""
ACE-Step v1.5 Cog predictor for Replicate.

Based on the RunPod handler at serverless/ace-step/handler.py.
Input/output shapes match what aceStepService.ts sends and
replicateService.ts expects.
"""

import os
import time
import tempfile
from pathlib import Path as PathLib
from typing import Optional

import numpy as np
import soundfile as sf
from cog import BasePredictor, Input, Path

# ── Constants (mirrors handler.py) ─────────────────────────────────────

CHECKPOINT_DIR = os.getenv("ACE_STEP_CHECKPOINT_DIR", "/src/checkpoints")
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


def build_instruction(task_type: str, track_name: str | None) -> str:
    from acestep.constants import TASK_INSTRUCTIONS, DEFAULT_DIT_INSTRUCTION
    template = TASK_INSTRUCTIONS.get(task_type, DEFAULT_DIT_INSTRUCTION)
    if "{TRACK_NAME}" in template and track_name:
        return template.format(TRACK_NAME=track_name)
    return template


def normalize_wav_duration(path: PathLib, target_duration_s: float) -> float:
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


class Predictor(BasePredictor):
    def setup(self):
        """Load ACE-Step model into GPU memory. Called once on cold start."""
        from acestep.handler import AceStepHandler

        offload = _as_bool(os.getenv("ACE_STEP_CPU_OFFLOAD", "false"))
        PathLib(CHECKPOINT_DIR).mkdir(parents=True, exist_ok=True)

        print(f"[ace-step] loading config={MODEL_CONFIG} device={DEVICE} offload={offload}")
        self.ace = AceStepHandler()
        init_status, ok = self.ace.initialize_service(
            project_root=CHECKPOINT_DIR,
            config_path=MODEL_CONFIG,
            device=DEVICE,
            offload_to_cpu=offload,
            prefer_source="huggingface",
        )
        if not ok:
            raise RuntimeError(f"AceStepHandler.initialize_service failed: {init_status}")

        print(f"[ace-step] model loaded: {init_status}")

    def predict(
        self,
        prompt: str = Input(description="Comma-separated tags: 'trap, hip-hop, 808, dark, minor'"),
        lyrics: str = Input(default="", description="Optional [verse]/[chorus] formatted lyrics"),
        audio_duration: float = Input(default=30.0, description="Duration in seconds"),
        infer_step: int = Input(default=32, description="Inference steps (32 base, 8 turbo)"),
        guidance_scale: float = Input(default=7.0),
        seed: Optional[int] = Input(default=None, description="Random seed"),
        task_type: str = Input(default="text2music", description="text2music | lego | extract | complete"),
        track_name: Optional[str] = Input(default=None, description="Required for lego task"),
        bpm: Optional[int] = Input(default=None, description="Optional tempo hint"),
    ) -> Path:
        """
        Generate audio from the prompt and return a WAV file.
        Replicate automatically uploads the returned Path and provides a URL.
        """
        from acestep.inference import generate_music, GenerationParams, GenerationConfig

        if task_type == "lego" and track_name and track_name not in VALID_TRACK_NAMES:
            raise ValueError(
                f"Invalid track_name '{track_name}'. Must be one of: {sorted(VALID_TRACK_NAMES)}"
            )

        if seed is None:
            seed = int(time.time()) % (2**31)

        t0 = time.time()
        generation_duration = audio_duration + EXTRA_GENERATION_SECONDS
        use_adg = "turbo" not in MODEL_CONFIG
        instruction = build_instruction(task_type, track_name)

        params = GenerationParams(
            task_type=task_type,
            caption=prompt,
            lyrics=lyrics,
            duration=generation_duration,
            bpm=int(bpm) if bpm is not None else None,
            seed=seed,
            instruction=instruction,
            inference_steps=infer_step,
            guidance_scale=guidance_scale,
            use_adg=use_adg,
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

        print(f"[ace-step] generating duration={generation_duration:.1f}s steps={infer_step} seed={seed}", flush=True)
        save_dir = tempfile.mkdtemp(prefix="ace-step-")
        result = generate_music(
            dit_handler=self.ace,
            llm_handler=None,
            params=params,
            config=config,
            save_dir=save_dir,
        )
        elapsed = time.time() - t0
        print(f"[ace-step] inference done in {elapsed:.1f}s; success={result.success}", flush=True)

        if not result.success or not result.audios:
            raise RuntimeError(result.error or "ACE-Step generation produced no audio")

        audio_path = PathLib(result.audios[0]["path"])
        if not audio_path.exists():
            raise RuntimeError(f"Generated audio file not found at {audio_path}")

        normalize_wav_duration(audio_path, audio_duration)
        return Path(str(audio_path))
