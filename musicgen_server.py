"""
MusicGen-Stem Sidecar Server
Run alongside the Node.js server to provide native multi-stem AI generation.

Start with:
  uvicorn musicgen_server:app --host 0.0.0.0 --port 8001

Requirements:
  pip install fastapi uvicorn audiocraft torch torchaudio
"""

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MusicGen-Stem Sidecar")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store. For production, swap to Redis or PostgreSQL.
jobs: dict = {}

# Lazy-load model so the server starts fast and loads on first request
_model = None


def get_model():
    global _model
    if _model is None:
        logger.info("Loading MusicGen-Stem model (first request — this takes ~30s)...")
        from audiocraft.models import MusicGen
        _model = MusicGen.get_pretrained("facebook/musicgen-stem")
        logger.info("✅ MusicGen-Stem model loaded")
    return _model


class StemRequest(BaseModel):
    prompt: str
    duration: int = 10       # seconds
    bpm: int = 120
    key: str = "C"
    job_id: str | None = None  # optional — caller can supply its own id


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/generate")
async def generate_stems(req: StemRequest, background_tasks: BackgroundTasks):
    job_id = req.job_id or str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "stems": [], "error": None}
    background_tasks.add_task(_run_generation, job_id, req)
    return {"job_id": job_id, "status": "pending"}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return {"status": "not_found"}
    return {"job_id": job_id, **job}


# ── background task ──────────────────────────────────────────────────────────

def _run_generation(job_id: str, req: StemRequest):
    """Blocking generation — runs in a thread pool via BackgroundTasks."""
    try:
        jobs[job_id]["status"] = "processing"

        model = get_model()
        model.set_generation_params(duration=req.duration)

        full_prompt = f"{req.prompt}, {req.bpm} bpm, key of {req.key}"
        logger.info(f"[{job_id}] Generating stems for: {full_prompt!r}")

        stems_tensor = model.generate([full_prompt])  # shape: (batch, stems, samples)

        from audiocraft.data.audio import audio_write

        stem_names = ["drums", "bass", "other"]
        output_paths = []

        tmp_dir = "/tmp/musicgen"
        os.makedirs(tmp_dir, exist_ok=True)

        for i, name in enumerate(stem_names):
            stem_audio = stems_tensor[0, i].unsqueeze(0)  # (1, samples)
            out_path = os.path.join(tmp_dir, f"{job_id}_{name}")
            audio_write(out_path, stem_audio.cpu(), model.sample_rate, strategy="loudness")
            output_paths.append(f"{out_path}.wav")
            logger.info(f"[{job_id}] Saved {name} → {out_path}.wav")

        jobs[job_id] = {
            "status": "complete",
            "stems": {stem_names[i]: output_paths[i] for i in range(len(stem_names))},
            "error": None,
        }
        logger.info(f"[{job_id}] Generation complete ✅")

    except Exception as exc:
        logger.error(f"[{job_id}] Generation failed: {exc}", exc_info=True)
        jobs[job_id] = {"status": "error", "stems": [], "error": str(exc)}
