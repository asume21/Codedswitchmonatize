FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    ACE_STEP_CHECKPOINT_DIR=/runpod-volume/checkpoints \
    ACE_STEP_OUTPUT_DIR=/tmp/ace-step-output \
    ACE_STEP_CPU_OFFLOAD=false \
    ACE_STEP_BF16=true

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir --force-reinstall \
      torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
      --index-url https://download.pytorch.org/whl/cu121

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt \
    && python -m pip install --no-cache-dir git+https://github.com/ace-step/ACE-Step.git

COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
