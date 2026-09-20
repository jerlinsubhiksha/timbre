from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json

app = FastAPI(title="VOXGUARD Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Call Signaling State
active_connections = {} # uid -> websocket

class VoxDetector:
    def __init__(self):
        self.risk_history = []
        
    def analyze(self, audio_data):
        energy = np.sum(audio_data**2) / len(audio_data) if len(audio_data) > 0 else 0
        speech_detected = bool(energy > 0.0001)
        
        noise_level = "LOW"
        if energy > 0.05: noise_level = "HIGH"
        elif energy > 0.01: noise_level = "MEDIUM"

        model_status = "MODEL NOT CONFIGURED"
        final_classification = "UNCERTAIN"
        details = "Acoustic ML inference requires configured pretrained weights. Fallback to basic heuristics."
        
        if not speech_detected:
            final_classification = "WAITING"
            
        return {
            "speech_detected": speech_detected,
            "noise_level": noise_level,
            "model_status": model_status,
            "final_classification": final_classification,
            "details": details
        }

detector = VoxDetector()

@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data:
                audio_np = np.frombuffer(data["bytes"], dtype=np.float32)
                result = detector.analyze(audio_np)
                await websocket.send_json(result)
    except WebSocketDisconnect:
        pass

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
                # Forward the message to the target user, injecting the sender's uid
                msg["sender_uid"] = uid
                await target_ws.send_text(json.dumps(msg))
            else:
                # Target user is not online
                if msg.get("type") == "offer":
                    await websocket.send_text(json.dumps({"type": "error", "message": "User is not online."}))
                    
    except WebSocketDisconnect:
        if uid in active_connections:
            del active_connections[uid]
