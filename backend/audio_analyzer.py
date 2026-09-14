import numpy as np
import librosa
import random

class VoiceAnalyzer:
    def __init__(self):
        print("Initializing Voice Analyzer (Simulated ML Model)")
        self.risk_history = []
        self.window_size = 5
        
    def reset(self):
        self.risk_history = []

    def analyze_chunk(self, audio_data, sample_rate, mode="unknown"):
        # 1. Voice Activity Detection (VAD) heuristic
        energy = np.sum(audio_data**2) / len(audio_data) if len(audio_data) > 0 else 0
        if energy < 0.0001:
            return {"speech_detected": False, "synthetic_score": 0.0, "rolling_risk": 0.0, "speaker_match": 0.0}
            
        # 2. Extract features (Simulating what a real model does)
        # mfccs = librosa.feature.mfcc(y=audio_data, sr=sample_rate, n_mfcc=13)
        
        # 3. Model Inference (Simulated)
        if mode == "fake":
            base_score = 0.85
        elif mode == "real":
            base_score = 0.15
        else:
            base_score = 0.5
            
        score = float(np.clip(base_score + random.uniform(-0.15, 0.15), 0.0, 1.0))
        
        # 4. Fusion Engine
        self.risk_history.append(score)
        if len(self.risk_history) > self.window_size:
            self.risk_history.pop(0)
            
        rolling_risk = float(sum(self.risk_history) / len(self.risk_history))
        speaker_match = float(round(random.uniform(0.85, 0.99), 2))
        
        return {
            "speech_detected": True,
            "synthetic_score": round(score, 3),
            "rolling_risk": round(rolling_risk, 3),
            "speaker_match": speaker_match
        }

