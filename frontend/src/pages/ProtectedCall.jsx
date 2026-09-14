import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Shield, ShieldAlert, ShieldCheck, PhoneIncoming } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function ProtectedCall() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  const [targetUser, setTargetUser] = useState('');
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('Disconnected');
  const [incomingCall, setIncomingCall] = useState(null);
  
  const [remoteResults, setRemoteResults] = useState(null);
  const [localResults, setLocalResults] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const signalingWs = useRef(null);
  const localStreamRef = useRef(null);
  
  const localAnalyzeWs = useRef(null);
  const remoteAnalyzeWs = useRef(null);
  const localAudioContext = useRef(null);
  const remoteAudioContext = useRef(null);
  
  const challenges = ["Please say: The quick brown fox.", "Please say: Blue elephant 27.", "What color is the sky?"];
  const [activeChallenge, setActiveChallenge] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    signalingWs.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/call/${currentUser.uid}`);
    
    signalingWs.current.onopen = () => {
      setCallStatus('Online - Ready to Call');
    };

    signalingWs.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'offer') {
        setIncomingCall({ offer: data.offer, caller_uid: data.sender_uid });
      } else if (data.type === 'answer' && peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('Connected');
      } else if (data.type === 'candidate' && peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else if (data.type === 'challenge') {
        setActiveChallenge(data.challenge);
      } else if (data.type === 'error') {
        setCallStatus(`Error: ${data.message}`);
        setTimeout(() => setCallStatus('Online - Ready to Call'), 3000);
      }
    };

    return () => {
      endCall();
    };
  }, [currentUser, navigate]);

  const setupMediaAndPC = async (targetUid) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true }, video: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      startAnalyzingLocalStream(stream);

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
          signalingWs.current.send(JSON.stringify({ 
            type: 'candidate', 
            target_uid: targetUid,
            candidate: event.candidate 
          }));
        }
      };
      
      return pc;
    } catch (err) {
      console.error(err);
      alert("Failed to access camera/mic");
      return null;
    }
  };

  const startCall = async () => {
    if (!targetUser) return alert('Enter an email or phone number');
    
    setCallStatus('Looking up user...');
    try {
      const usersRef = collection(db, "users");
      
      // Check if input is an email
      let q = query(usersRef, where("email", "==", targetUser));
      let querySnapshot = await getDocs(q);
      
      // If not found by email, check phone
      if (querySnapshot.empty) {
        q = query(usersRef, where("phone", "==", targetUser));
        querySnapshot = await getDocs(q);
      }
      
      if (querySnapshot.empty) {
        setCallStatus('User not found. Check the email or phone number.');
        setTimeout(() => setCallStatus('Online - Ready to Call'), 3000);
        return;
      }
      
      const targetUid = querySnapshot.docs[0].data().uid;
      setInCall(true);
      setCallStatus('Ringing...');

      const pc = await setupMediaAndPC(targetUid);
      if (!pc) return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      signalingWs.current.send(JSON.stringify({ 
        type: 'offer', 
        target_uid: targetUid,
        offer 
      }));
      
    } catch (err) {
      console.error(err);
      setCallStatus('Error connecting call.');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const { offer, caller_uid } = incomingCall;
    
    setIncomingCall(null);
    setInCall(true);
    setCallStatus('Connecting...');

    const pc = await setupMediaAndPC(caller_uid);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    signalingWs.current.send(JSON.stringify({ 
      type: 'answer', 
      target_uid: caller_uid,
      answer 
    }));
    
    setCallStatus('Connected');
  };

  const rejectCall = () => {
    setIncomingCall(null);
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
        if (localAnalyzeWs.current?.readyState === WebSocket.OPEN) {
           localAnalyzeWs.current.send(e.inputBuffer.getChannelData(0).buffer);
        }
      };
    };
    localAnalyzeWs.current.onmessage = (e) => setLocalResults(JSON.parse(e.data));
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
        if (remoteAnalyzeWs.current?.readyState === WebSocket.OPEN) {
           remoteAnalyzeWs.current.send(e.inputBuffer.getChannelData(0).buffer);
        }
      };
    };
    remoteAnalyzeWs.current.onmessage = (e) => setRemoteResults(JSON.parse(e.data));
  };

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localAnalyzeWs.current) localAnalyzeWs.current.close();
    if (remoteAnalyzeWs.current) remoteAnalyzeWs.current.close();
    if (localAudioContext.current) localAudioContext.current.close();
    if (remoteAudioContext.current) remoteAudioContext.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    
    setInCall(false);
    setCallStatus('Online - Ready to Call');
    setRemoteResults(null);
    setLocalResults(null);
    setActiveChallenge(null);
  };

  const sendChallenge = () => {
    const text = challenges[Math.floor(Math.random() * challenges.length)];
    setActiveChallenge("Dynamic Liveness UI Test Triggered");
  };

  const ResultCard = ({ title, results }) => {
    if (!results) return <div className="flex-1 border border-vox-gray-dark/30 rounded-xl p-4 flex items-center justify-center text-sm opacity-50 bg-black/20">Waiting...</div>;
    const isThreat = results.final_classification === 'AI / SYNTHETIC';
    return (
      <div className={`flex-1 border rounded-xl p-4 transition-colors ${isThreat ? 'border-vox-orange bg-vox-orange/10' : 'border-green-500/50 bg-green-500/5'}`}>
        <h4 className="text-xs font-bold opacity-60 mb-2 uppercase">{title}</h4>
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] uppercase opacity-80">Authenticity</p>
            <p className={`text-lg font-bold ${isThreat ? 'text-vox-orange' : 'text-green-400'}`}>{results.final_classification}</p>
          </div>
        </div>
      </div>
    );
  };

  if (!currentUser) return null;

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full p-6 flex flex-col relative">
      
      {incomingCall && !inCall && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-vox-navy border-2 border-vox-orange p-6 rounded-2xl shadow-[0_0_50px_rgba(249,115,22,0.4)] text-center animate-bounce">
          <PhoneIncoming size={48} className="text-vox-orange mx-auto mb-4 animate-pulse" />
          <h3 className="text-2xl font-bold text-white mb-6">Incoming Secure Call</h3>
          <div className="flex gap-4">
            <button onClick={acceptCall} className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold">Accept</button>
            <button onClick={rejectCall} className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold">Reject</button>
          </div>
        </div>
      )}

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
          <h3 className="text-2xl font-bold text-white mb-2">Call a Contact</h3>
          <p className="text-sm text-vox-gray mb-6">Enter the Email Address or Phone Number of the VoxGuard user you wish to call securely.</p>
          <input 
            type="text" 
            placeholder="Email or Phone Number" 
            className="w-full bg-vox-navy border border-vox-gray-dark p-3 rounded mb-6 text-white"
            value={targetUser}
            onChange={e => setTargetUser(e.target.value)}
          />
          <button onClick={startCall} className="w-full bg-vox-orange text-white py-3 rounded font-bold hover:bg-orange-600 transition-colors">Start Call</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="relative bg-black rounded-2xl overflow-hidden flex-1 border border-vox-gray-dark/30 shadow-lg min-h-[400px]">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
              <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-sm text-white font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Remote Peer
              </div>
              
              {activeChallenge && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 bg-vox-orange text-white px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.6)] font-bold text-center border-2 border-white z-10"
                >
                  <p className="text-xs uppercase opacity-90 mb-1">Liveness Challenge Issued</p>
                  <p className="text-xl">"{activeChallenge}"</p>
                </motion.div>
              )}

              <div className="absolute bottom-4 right-4 w-48 aspect-video bg-vox-navy border-2 border-vox-gray-dark/50 rounded-xl overflow-hidden shadow-2xl">
                 <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                 <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded text-xs text-white">You</div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-6 bg-vox-navy-light rounded-2xl border border-vox-gray-dark/30 p-4">
               <button onClick={endCall} className="bg-red-600 px-8 py-3 rounded-full hover:bg-red-700 text-white font-bold flex items-center gap-2"><PhoneOff size={20} /> End Call</button>
               <div className="h-8 w-px bg-vox-gray-dark/30"></div>
               <button onClick={sendChallenge} className="bg-vox-navy border border-vox-orange text-vox-orange px-6 py-3 rounded-full font-bold"><ShieldAlert size={20} className="inline mr-2"/> Issue Challenge</button>
            </div>
          </div>

          <div className="bg-vox-navy-light rounded-2xl p-5 border border-vox-gray-dark/30 flex flex-col gap-4 shadow-lg">
             <div className="pb-4 border-b border-vox-gray-dark/30">
               <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield className="text-vox-orange" size={20} /> AI Analysis</h3>
             </div>
             <div className="flex-1 flex flex-col gap-4">
                <ResultCard title="Remote Speaker" results={remoteResults} />
                <ResultCard title="Local Speaker" results={localResults} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
