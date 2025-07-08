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

# Pre-import torch and set threading parameters before any other imports
try:
    import torch
    torch.set_num_threads(1)
    # Don't call set_num_interop_threads here as it's causing the error
except ImportError:
    pass

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
    "Because the problem is",
    "And give me",
    "But I need to",
    "So if you could",
    "And tell me about",
    "Could you please give me",
    "I want you to explain",
    "When you consider the",
    "As I was saying about the"
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
    # Check for interruption words
    if any(word in txt for word in INTERRUPT_WORDS):
        return "INTERRUPT"
    
    # Check for ending punctuation that indicates completion
    if re.search(r"[.!?]$", txt):
        return "COMPLETE"
    
    # Short phrases are likely incomplete
    if len(txt.split()) < 4:
        return "CONTINUE"
    
    # Check for common incomplete phrase starters
    incomplete_starters = ["and", "but", "so", "or", "if", "when", "because", "while", "as"]
    if txt.split()[0].lower() in incomplete_starters and len(txt.split()) < 6:
        return "CONTINUE"
    
    # Check for prepositions at the end which usually indicate incompleteness
    ending_prepositions = ["in", "on", "at", "to", "with", "for", "about", "from", "by", "of"]
    if txt.split()[-1].lower() in ending_prepositions:
        return "CONTINUE"
    
    # Default to complete for longer phrases without other indicators
    return "COMPLETE"

# Configure PyTorch before importing
def load_model():
    global model, complete_embeds, incomplete_embeds, ml_ready
    try:
        # Import and configure torch first, before any other imports
        import torch
        # Set threading options before any parallel work happens
        torch.set_num_threads(1)
        
        # Now import the rest
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

        # Debug output
        print(json.dumps({
            "type": "debug", 
            "message": f"Sentence detection scores: complete={sim_c:.4f}, incomplete={sim_i:.4f}, text='{text}'"
        }), flush=True)

        # Adjust thresholds and logic
        if sim_c > 0.45 and sim_c > sim_i + 0.05:
            return "COMPLETE"
        elif sim_i > sim_c or len(text.split()) < 5:
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
