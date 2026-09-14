import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProtectedCall() {
  const [roomId, setRoomId] = useState('');
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('Disconnected');
  const [remoteResults, setRemoteResults] = useState(null);
  const [localResults, setLocalResults] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const signalingWs = useRef(null);
  
  const localAnalyzeWs = useRef(null);
  const remoteAnalyzeWs = useRef(null);
  const localAudioContext = useRef(null);
  const remoteAudioContext = useRef(null);
  const localStreamRef = useRef(null);
  
  const challenges = [
    "Please say: The quick brown fox.",
    "Please say: Blue elephant 27.",
    "What color is the sky?"
  ];
  const [activeChallenge, setActiveChallenge] = useState(null);

  useEffect(() => {
    return () => endCall();
  }, []);

  const initCall = async (isInitiator) => {
    if (!roomId) return alert('Enter a room ID');
    
    setInCall(true);
    setCallStatus('Connecting...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true }, 
        video: true 
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Start analyzing local stream
      startAnalyzingLocalStream(stream);

      signalingWs.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/call/${roomId}`);
      
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnection.current = pc;
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          startAnalyzingRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && signalingWs.current?.readyState === WebSocket.OPEN) {
          signalingWs.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      signalingWs.current.onopen = async () => {
        setCallStatus('Waiting for peer...');
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signalingWs.current.send(JSON.stringify({ type: 'offer', offer }));
        }
      };

      signalingWs.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalingWs.current.send(JSON.stringify({ type: 'answer', answer }));
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallStatus('Connected');
        } else if (data.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else if (data.type === 'challenge') {
          setActiveChallenge(data.challenge);
        }
      };

    } catch (err) {
      console.error(err);
      setCallStatus('Error connecting hardware.');
    }
  };

  const startAnalyzingLocalStream = (stream) => {
    localAnalyzeWs.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/analyze`);
    
    localAnalyzeWs.current.onopen = () => {
      localAudioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = localAudioContext.current.createMediaStreamSource(stream);
      const processor = localAudioContext.current.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(localAudioContext.current.destination);
      
      processor.onaudioprocess = (e) => {
        if (localAnalyzeWs.current && localAnalyzeWs.current.readyState === WebSocket.OPEN) {
           localAnalyzeWs.current.send(e.inputBuffer.getChannelData(0).buffer);
        }
      };
    };

    localAnalyzeWs.current.onmessage = (event) => {
      setLocalResults(JSON.parse(event.data));
    };
  };

  const startAnalyzingRemoteStream = (stream) => {
    remoteAnalyzeWs.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/analyze`);
    
    remoteAnalyzeWs.current.onopen = () => {
      remoteAudioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = remoteAudioContext.current.createMediaStreamSource(stream);
      const processor = remoteAudioContext.current.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(remoteAudioContext.current.destination);
      
      processor.onaudioprocess = (e) => {
        if (remoteAnalyzeWs.current && remoteAnalyzeWs.current.readyState === WebSocket.OPEN) {
           remoteAnalyzeWs.current.send(e.inputBuffer.getChannelData(0).buffer);
        }
      };
    };

    remoteAnalyzeWs.current.onmessage = (event) => {
      setRemoteResults(JSON.parse(event.data));
    };
  };

  const endCall = () => {
    if (peerConnection.current) peerConnection.current.close();
    if (signalingWs.current) signalingWs.current.close();
    
    if (localAnalyzeWs.current) localAnalyzeWs.current.close();
    if (remoteAnalyzeWs.current) remoteAnalyzeWs.current.close();
    
    if (localAudioContext.current) localAudioContext.current.close();
    if (remoteAudioContext.current) remoteAudioContext.current.close();
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    
    setInCall(false);
    setCallStatus('Disconnected');
    setRemoteResults(null);
    setLocalResults(null);
    setActiveChallenge(null);
  };

  const sendChallenge = () => {
    const text = challenges[Math.floor(Math.random() * challenges.length)];
    if (signalingWs.current && signalingWs.current.readyState === WebSocket.OPEN) {
       signalingWs.current.send(JSON.stringify({ type: 'challenge', challenge: text }));
    }
  };

  const ResultCard = ({ title, results }) => {
    if (!results) return (
      <div className="flex-1 border border-vox-gray-dark/30 rounded-xl p-4 flex items-center justify-center text-sm opacity-50 bg-black/20">
        Waiting for audio...
      </div>
    );

    const isUncertain = results.final_classification === 'UNCERTAIN' || results.final_classification === 'WAITING';
    const isThreat = results.final_classification === 'AI / SYNTHETIC';

    return (
      <div className={`flex-1 border rounded-xl p-4 transition-colors ${isUncertain ? 'border-yellow-500/50 bg-yellow-500/5' : isThreat ? 'border-vox-orange bg-vox-orange/10' : 'border-green-500/50 bg-green-500/5'}`}>
        <h4 className="text-xs font-bold opacity-60 mb-2 uppercase">{title}</h4>
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-80">Authenticity</p>
            <p className={`text-lg font-bold ${isUncertain ? 'text-yellow-500' : isThreat ? 'text-vox-orange' : 'text-green-400'}`}>
              {results.final_classification}
            </p>
          </div>
          {isThreat ? <ShieldAlert className="text-vox-orange pb-1" size={28} /> : <ShieldCheck className="text-green-400 pb-1" size={28} />}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>Speech:</span> <span className="font-bold">{results.speech_detected ? 'YES' : 'NO'}</span></div>
          <div className="flex justify-between"><span>Noise:</span> <span className="font-bold">{results.noise_level}</span></div>
          <div className="flex justify-between pt-1 border-t border-white/10">
            <span>Model:</span> <span className="font-bold text-vox-orange truncate max-w-[100px]">{results.model_status}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-3xl font-bold text-white flex items-center gap-3">
           <Shield className="text-green-400" /> VoxGuard Call Platform
         </h2>
         <span className="bg-vox-navy-light px-3 py-1 rounded text-sm border border-vox-gray-dark/30 shadow-inner">
           Status: <span className="text-vox-orange font-medium">{callStatus}</span>
         </span>
      </div>
      
      {!inCall ? (
        <div className="bg-vox-navy-light p-8 rounded-2xl max-w-md mx-auto mt-12 border border-vox-gray-dark/30 text-center shadow-2xl">
          <div className="w-16 h-16 bg-vox-orange/10 text-vox-orange rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone size={32} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Start Secure Call</h3>
          <p className="text-sm text-vox-gray mb-6">VoxGuard will record and analyze both ends of the conversation in real-time for AI generation.</p>
          <input 
            type="text" 
            placeholder="Enter Room ID (e.g. 1234)" 
            className="w-full bg-vox-navy border border-vox-gray-dark p-3 rounded mb-6 text-white focus:outline-none focus:border-vox-orange transition-colors"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
          />
          <div className="flex gap-4">
            <button onClick={() => initCall(true)} className="flex-1 bg-vox-orange text-white py-3 rounded font-bold hover:bg-orange-600 transition-colors">Start Room</button>
            <button onClick={() => initCall(false)} className="flex-1 bg-vox-navy border border-vox-gray-dark text-white py-3 rounded font-bold hover:bg-vox-navy-light transition-colors">Join Room</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          {/* Main Video Area */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="relative bg-black rounded-2xl overflow-hidden flex-1 border border-vox-gray-dark/30 shadow-lg min-h-[400px]">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
              <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-sm text-white font-medium flex items-center gap-2 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Remote Peer
              </div>
              
              {activeChallenge && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 bg-vox-orange text-white px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.6)] font-bold text-center border-2 border-white z-10"
                >
                  <p className="text-xs uppercase opacity-90 mb-1 tracking-wider">Liveness Challenge Issued</p>
                  <p className="text-xl">"{activeChallenge}"</p>
                </motion.div>
              )}

              {/* Picture in Picture Local Video */}
              <div className="absolute bottom-4 right-4 w-48 aspect-video bg-vox-navy border-2 border-vox-gray-dark/50 rounded-xl overflow-hidden shadow-2xl">
                 <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                 <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded text-xs text-white">You</div>
              </div>
            </div>
            
            {/* Call Controls */}
            <div className="flex items-center justify-center gap-6 bg-vox-navy-light rounded-2xl border border-vox-gray-dark/30 p-4">
               <button onClick={endCall} className="bg-red-600 px-8 py-3 rounded-full hover:bg-red-700 text-white font-bold flex items-center gap-2 transition-transform hover:scale-105">
                 <PhoneOff size={20} /> End Call
               </button>
               <div className="h-8 w-px bg-vox-gray-dark/30"></div>
               <button onClick={sendChallenge} className="bg-vox-navy border border-vox-orange text-vox-orange hover:bg-vox-orange hover:text-white px-6 py-3 rounded-full font-bold transition-all flex items-center gap-2">
                 <ShieldAlert size={20} /> Issue Challenge
               </button>
            </div>
          </div>

          {/* AI Monitor Sidebar */}
          <div className="bg-vox-navy-light rounded-2xl p-5 border border-vox-gray-dark/30 flex flex-col gap-4 shadow-lg">
             <div className="pb-4 border-b border-vox-gray-dark/30">
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <Shield className="text-vox-orange" size={20} /> AI Call Analysis
               </h3>
               <p className="text-xs text-vox-gray mt-1">VoxGuard is recording and scanning both audio streams.</p>
             </div>
             
             <div className="flex-1 flex flex-col gap-4">
                <ResultCard title="Remote Speaker Analysis" results={remoteResults} />
                <ResultCard title="Local Speaker Analysis" results={localResults} />
             </div>
             
             <div className="pt-4 border-t border-vox-gray-dark/30 text-xs opacity-60 text-center">
               End-to-end continuous monitoring active.
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
