FROM nvidia/cuda:12.8.0-cudnn9-devel-ubuntu22.04

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

RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common curl ca-certificates \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3.11-venv \
    ffmpeg git libsndfile1 espeak-ng \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python  python  /usr/bin/python3.11 1 \
    && rm -rf /var/lib/apt/lists/*

# uv manages Python packages and handles the local nano-vllm dependency
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Clone ACE-Step 1.5 at latest stable tag
RUN git clone --depth 1 --branch v0.1.7 \
    https://github.com/ace-step/ACE-Step-1.5.git /ace-step

WORKDIR /ace-step

# uv sync installs all deps including the local nano-vllm third-party package
RUN uv sync --no-dev --python 3.11

# Add RunPod SDK and HF transfer into the same venv
RUN uv pip install \
    "runpod>=1.7.9" \
    "huggingface_hub[hf_transfer]>=0.25.0" \
    "hf_transfer>=0.1.8" \
    "soundfile>=0.12.1"

ENV PATH="/ace-step/.venv/bin:$PATH"

COPY handler.py /app/handler.py

WORKDIR /app
CMD ["python", "-u", "/app/handler.py"]
