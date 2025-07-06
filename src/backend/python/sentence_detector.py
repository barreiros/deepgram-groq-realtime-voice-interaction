#!/usr/bin/env python3
import sys
import json
import signal
import os
import gc
import re

# Setup environment to avoid native crashes
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['NUMEXPR_NUM_THREADS'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

model = None
complete_embeds = None
incomplete_embeds = None
ml_ready = False

# Interruptions and example phrases
INTERRUPT_WORDS = ["stop", "wait", "pause", "hold on", "silence", "enough", "stop talking"]
COMPLETE_EXAMPLES = [
    "What time is it?",
    "I agree.",
    "Let's move on.",
    "That's fine.",
    "I need your help.",
    "Tell me more about that.",
    "Could you explain it?",
    "How are you doing?",
    "And if you were a human, what then do you prefer?",
    "Are you there?",
    "Hello?",
    "Can you help me understand?"
]
INCOMPLETE_EXAMPLES = [
    "So what I was thinking is",
    "When you try to",
    "The reason I said that is",
    "If we could just",
    "And then I would",
    "Because the problem is"
]

# Shutdown handler
def handle_signal(sig, frame):
    print(json.dumps({"type": "shutdown", "message": f"Signal {sig}"}), flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

# Rule-based fallback
def rule_based(text):
    txt = text.lower().strip()
    if any(word in txt for word in INTERRUPT_WORDS):
        return "INTERRUPT"
    if re.search(r"[.!?]$", txt):
        return "COMPLETE"
    if len(txt.split()) < 3:
        return "CONTINUE"
    return "COMPLETE"

# Lazy ML loader
def load_model():
    global model, complete_embeds, incomplete_embeds, ml_ready
    try:
        import torch
        torch.set_num_threads(1)
        torch.set_num_interop_threads(1)
        from sentence_transformers import SentenceTransformer
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np

        model = SentenceTransformer("paraphrase-MiniLM-L12-v2", device="cpu", normalize_embeddings=True)
        complete_embeds = model.encode(COMPLETE_EXAMPLES, batch_size=1, show_progress_bar=False)
        incomplete_embeds = model.encode(INCOMPLETE_EXAMPLES, batch_size=1, show_progress_bar=False)
        ml_ready = True
    except Exception as e:
        model = None
        ml_ready = False
        print(json.dumps({"type": "info", "message": f"Failed to load ML model: {str(e)}"}), flush=True)

# ML-based prediction
def ml_based(text):
    global ml_ready
    if not ml_ready:
        load_model()
    if not ml_ready:
        return rule_based(text)

    try:
        from sklearn.metrics.pairwise import cosine_similarity
        input_vec = model.encode([text], batch_size=1, show_progress_bar=False)
        sim_c = max(cosine_similarity(input_vec, complete_embeds)[0])
        sim_i = max(cosine_similarity(input_vec, incomplete_embeds)[0])

        if sim_c > 0.40 and sim_c > sim_i:
            return "COMPLETE"
        elif sim_i > sim_c:
            return "CONTINUE"
        else:
            return rule_based(text)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"ML prediction failed: {str(e)}"}), flush=True)
        return rule_based(text)

# Main loop
print(json.dumps({"type": "ready"}), flush=True)

for line in sys.stdin:
    try:
        req = json.loads(line.strip())
        text = req.get("text", "")
        rid = req.get("requestId", 0)

        if not text.strip():
            continue

        result = ml_based(text)
        print(json.dumps({"type": "result", "requestId": rid, "result": {"status": result}}), flush=True)

    except Exception as e:
        print(json.dumps({"type": "error", "error": str(e)}), flush=True)
        gc.collect()
