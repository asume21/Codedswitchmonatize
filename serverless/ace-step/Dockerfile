FROM nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    ACE_STEP_CHECKPOINT_DIR=/runpod-volume/checkpoints \
    ACE_STEP_OUTPUT_DIR=/tmp/ace-step-output \
    ACE_STEP_MODEL_CONFIG=acestep-v15-base \
    ACE_STEP_CPU_OFFLOAD=false \
    ACE_STEP_DEVICE=cuda

# ── System deps ───────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common curl ca-certificates \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3.11-venv \
    ffmpeg git libsndfile1 espeak-ng \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python  python  /usr/bin/python3.11 1 \
    && python3.11 -m ensurepip --upgrade \
    && python3.11 -m pip install --no-cache-dir --upgrade pip \
    && rm -rf /var/lib/apt/lists/*

# ── Clone ACE-Step 1.5 ────────────────────────────────────────────────────────
RUN git clone --depth 1 --branch v0.1.7 \
    https://github.com/ace-step/ACE-Step-1.5.git /ace-step

# ── Step 1: nano-vllm from the bundled local path ────────────────────────────
# pyproject.toml routes this to /ace-step/acestep/third_parts/nano-vllm via
# [tool.uv.sources]; pip doesn't understand that so we pre-install it manually.
RUN python3.11 -m pip install --no-cache-dir \
    /ace-step/acestep/third_parts/nano-vllm

# ── Step 2: PyTorch from the cu128 wheel index ───────────────────────────────
# All nvidia-* cuda companion packages live on this index, not on PyPI.
RUN python3.11 -m pip install --no-cache-dir \
    "torch==2.10.0+cu128" \
    "torchaudio==2.10.0+cu128" \
    "torchvision==0.25.0+cu128" \
    --index-url https://download.pytorch.org/whl/cu128

# ── Step 3: ACE-Step package + remaining deps ─────────────────────────────────
# torch and nano-vllm are already satisfied; pip skips them.
# --extra-index-url covers any remaining torch-adjacent packages.
RUN python3.11 -m pip install --no-cache-dir \
    /ace-step \
    --extra-index-url https://download.pytorch.org/whl/cu128

# ── Step 4: RunPod SDK + HF transfer ─────────────────────────────────────────
RUN python3.11 -m pip install --no-cache-dir \
    "runpod>=1.7.9" \
    "huggingface_hub[hf_transfer]>=0.25.0" \
    "hf_transfer>=0.1.8" \
    "soundfile>=0.12.1"

COPY handler.py /app/handler.py

WORKDIR /app
CMD ["python3.11", "-u", "/app/handler.py"]
