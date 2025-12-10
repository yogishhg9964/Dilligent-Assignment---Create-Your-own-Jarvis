# Configuration for Jarvis Assistant

# Model configurations (ordered by speed - fastest first)
MODELS = {
    "fast": {
        "name": "llama3.2:1b",
        "description": "Fastest, good for quick responses",
        "options": {
            "temperature": 0.1,      # Lower = faster, more deterministic
            "top_p": 0.7,           # Smaller vocabulary = faster
            "top_k": 20,            # Limit token choices for speed
            "num_predict": 400,     # Keep response length
            "num_ctx": 2048,        # Keep context window
            "repeat_penalty": 1.05, # Lower penalty = faster
            "num_thread": -1,       # Use all CPU cores
            "num_gpu": 1,           # Use GPU if available
            "mirostat": 2,          # Better quality control
            "mirostat_tau": 5.0,    # Target perplexity
            "mirostat_eta": 0.1     # Learning rate
        }
    },
    "balanced": {
        "name": "llama3.2:3b",
        "description": "Good balance of speed and quality",
        "options": {
            "temperature": 0.5,
            "top_p": 0.9,
            "num_predict": 250,
            "num_ctx": 2048,
            "repeat_penalty": 1.1
        }
    },
    "quality": {
        "name": "llama3",
        "description": "Best quality, slower responses",
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
            "num_predict": 400,
            "num_ctx": 4096,
            "repeat_penalty": 1.1
        }
    },
    "ultra_fast": {
        "name": "llama3.2:1b",
        "description": "Maximum speed optimization",
        "options": {
            "temperature": 0.05,    # Very deterministic
            "top_p": 0.5,          # Very focused
            "top_k": 10,           # Minimal choices
            "num_predict": 300,    # Shorter but adequate
            "num_ctx": 2048,       # Keep context
            "repeat_penalty": 1.0, # No penalty for speed
            "num_thread": -1,      # All cores
            "num_gpu": 1,          # GPU acceleration
            "mirostat": 2,
            "mirostat_tau": 3.0,   # Lower target
            "mirostat_eta": 0.2    # Faster learning
        }
    }
}

# Current model setting
CURRENT_MODEL = "ultra_fast"  # Change to "balanced" or "quality" as needed

# Vector search settings
MAX_CONTEXT_LENGTH = 2000  # Increased for better context
TOP_K_RESULTS = 2