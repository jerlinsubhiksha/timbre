from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import os
import torch
import librosa

# Try to import our new AI Model
try:
    from model import VoxGuardCNN
    MODEL_AVAILABLE = True
except ImportError:
    MODEL_AVAILABLE = False

app = FastAPI(title="VOXGUARD Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = {} # uid -> websocket

class VoxDetector:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.is_loaded = False
        
        # Load the trained model if it exists
        weight_path = 'weights/voxguard_model.pth'
        if MODEL_AVAILABLE and os.path.exists(weight_path):
            try:
                self.model = VoxGuardCNN().to(self.device)
                self.model.load_state_dict(torch.load(weight_path, map_location=self.device, weights_only=True))
                self.model.eval()
                self.is_loaded = True
                print("Successfully loaded PyTorch Deepfake Detection Model!")
            except Exception as e:
                print(f"Failed to load model weights: {e}")
        
    def analyze(self, audio_data):
        energy = np.sum(audio_data**2) / len(audio_data) if len(audio_data) > 0 else 0
        speech_detected = bool(energy > 0.0001)
        
        noise_level = "LOW"
        if energy > 0.05: noise_level = "HIGH"
        elif energy > 0.01: noise_level = "MEDIUM"
        
        if not speech_detected:
            return {
                "speech_detected": False,
                "noise_level": noise_level,
                "model_status": "ONLINE" if self.is_loaded else "NOT CONFIGURED",
                "final_classification": "WAITING",
                "details": "Silence detected."
            }

        # ---------------------------------------------------------
        # AI ML INFERENCE
        # ---------------------------------------------------------
        if self.is_loaded:
            # 1. Convert raw PCM audio into a Mel Spectrogram
            # (WebSocket sends float32 at 16000 Hz)
            mel_spec = librosa.feature.melspectrogram(y=audio_data, sr=16000, n_mels=128, fmax=8000)
            log_mel_spec = librosa.power_to_db(mel_spec, ref=np.max)
            
            # Pad or truncate to 128 time-steps (matches our CNN input)
            max_len = 128
            if log_mel_spec.shape[1] < max_len:
                pad_width = max_len - log_mel_spec.shape[1]
                log_mel_spec = np.pad(log_mel_spec, pad_width=((0, 0), (0, pad_width)), mode='constant')
            else:
                log_mel_spec = log_mel_spec[:, :max_len]
                
            # 2. Convert to PyTorch Tensor: shape (Batch=1, Channels=1, Height=128, Width=128)
            tensor_input = torch.tensor(log_mel_spec, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(self.device)
            
            # 3. Run Inference
            with torch.no_grad():
                outputs = self.model(tensor_input)
                # Apply softmax to get confidence percentages
                probabilities = torch.nn.functional.softmax(outputs, dim=1)[0]
                human_prob = probabilities[0].item()
                ai_prob = probabilities[1].item()
            
            # 4. Determine Classification
            # Class 0: HUMAN, Class 1: AI
            is_ai = ai_prob > 0.5
            classification = "AI / SYNTHETIC" if is_ai else "AUTHENTIC HUMAN"
            
            return {
                "speech_detected": True,
                "noise_level": noise_level,
                "model_status": "ONLINE (PYTORCH)",
                "final_classification": classification,
                "details": f"Confidence: AI={ai_prob*100:.1f}%, Human={human_prob*100:.1f}%"
            }
        else:
            # Fallback if model isn't trained yet
            return {
                "speech_detected": True,
                "noise_level": noise_level,
                "model_status": "MODEL NOT CONFIGURED",
                "final_classification": "UNCERTAIN",
                "details": "Acoustic ML inference requires configured pretrained weights."
            }

detector = VoxDetector()

@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            audio_np = np.frombuffer(data, dtype=np.float32)
            result = detector.analyze(audio_np)
            await websocket.send_json(result)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Analyze WS Error: {e}")

@app.websocket("/ws/call/{uid}")
async def websocket_call(websocket: WebSocket, uid: str):
    await websocket.accept()
    active_connections[uid] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            target_uid = msg.get("target_uid")
            
            if target_uid and target_uid in active_connections:
                target_ws = active_connections[target_uid]
                msg["sender_uid"] = uid
                await target_ws.send_text(json.dumps(msg))
            else:
                if msg.get("type") == "offer":
                    await websocket.send_text(json.dumps({"type": "error", "message": "User is not online."}))
                    
    except WebSocketDisconnect:
        if uid in active_connections:
            del active_connections[uid]
    except Exception as e:
        print(f"Call WS Error: {e}")
        if uid in active_connections:
            del active_connections[uid]
