FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg libsndfile1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (much smaller than GPU version)
RUN pip install --no-cache-dir torch==2.1.2 --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download RMVPE model weights at build time
RUN mkdir -p assets/rmvpe && \
    python -c "import urllib.request; urllib.request.urlretrieve('https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.pt', 'assets/rmvpe/rmvpe.pt')" && \
    echo "RMVPE model downloaded successfully"

EXPOSE 7871

ENV PORT=7871

CMD ["python", "app.py"]
