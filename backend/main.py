from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import uuid

app = FastAPI(title="VOXGUARD Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Call Signaling Room State
rooms = {}

class VoxDetector:
    def __init__(self):
        self.risk_history = []
        
    def analyze(self, audio_data):
        # 1. Voice Activity Detection (VAD) & Noise
        energy = np.sum(audio_data**2) / len(audio_data) if len(audio_data) > 0 else 0
        speech_detected = energy > 0.0001
        
        noise_level = "LOW"
        if energy > 0.05: noise_level = "HIGH"
        elif energy > 0.01: noise_level = "MEDIUM"

        # 2. AI Model Inference (No Fake Scores)
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

# Basic Signaling Server for WebRTC Calls
@app.websocket("/ws/call/{room_id}")
async def websocket_call(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in rooms:
        rooms[room_id] = []
    
    if len(rooms[room_id]) >= 2:
        await websocket.send_json({"type": "error", "message": "Room full"})
        await websocket.close()
        return

    rooms[room_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast to the OTHER person in the room
            for client in rooms[room_id]:
                if client != websocket:
                    await client.send_text(data)
    except WebSocketDisconnect:
        rooms[room_id].remove(websocket)
        if len(rooms[room_id]) == 0:
            del rooms[room_id]
