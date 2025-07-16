FROM node:24-slim

# Set environment variables to control CPU threading and HuggingFace caching
ENV HF_HOME=/app/huggingface \
    TRANSFORMERS_CACHE=/app/huggingface \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    TOKENIZERS_PARALLELISM=false \
    CUDA_VISIBLE_DEVICES='' \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --break-system-packages -r requirements.txt

# Preload the Sentence Transformer model (in production: 'paraphrase-MiniLM-L12-v2')
RUN python3 -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('paraphrase-MiniLM-L12-v2', device='cpu', cache_folder='/app/huggingface')"

# Install Node dependencies (production only)
RUN npm install

# Copy the entire app
COPY . .

# Define build-time argument
ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build the production frontend
RUN npm run build

# Expose backend port
EXPOSE 7860

# Run backend only in production (assumes frontend is statically built)
CMD ["npm", "start"]
