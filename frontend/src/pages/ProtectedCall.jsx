import React, { useState, useEffect, useRef } from 'react';
import { Shield, Phone, PhoneOff, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';

export default function ProtectedCall() {
  const { currentUser } = useAuth();
  
  const [callStatus, setCallStatus] = useState('Idle');
  const [targetUser, setTargetUser] = useState('');
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  
  const [remoteResults, setRemoteResults] = useState(null);
  const [localResults, setLocalResults] = useState(null);
  const [grokAlert, setGrokAlert] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const signalingWs = useRef(null);
  
  const localAudioContext = useRef(null);
  const remoteAudioContext = useRef(null);
  const localAnalyzeWs = useRef(null);
  const remoteAnalyzeWs = useRef(null);
  const grokWs = useRef(null);
  const speechReco = useRef(null);
  
  const [activeChallenge, setActiveChallenge] = useState(null);
  
  const challenges = [
    "Say the word 'Pineapple'",
    "Tap your microphone twice",
    "Repeat: The quick brown fox",
  ];

  useEffect(() => {
    if (!currentUser) return;

    const wsUrl = `ws://${window.location.hostname}:8000/ws/call/${currentUser.uid}`;
    signalingWs.current = new WebSocket(wsUrl);

    signalingWs.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'offer') {
        setIncomingCall({ offer: data.offer, caller_uid: data.sender_uid });
      } else if (data.type === 'answer' && peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('Connected');
        setInCall(true);
      } else if (data.type === 'candidate' && peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else if (data.type === 'error') {
        setCallStatus('Failed');
        alert(data.message);
      } else if (data.type === 'end_call') {
        handleEndCall(true);
      }
    };

    return () => signalingWs.current?.close();
  }, [currentUser]);

  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (grokWs.current?.readyState === WebSocket.OPEN) {
          grokWs.current.send(JSON.stringify({ text: transcript, uid: currentUser.uid }));
        }
      };
      
      recognition.start();
      speechReco.current = recognition;
    }
  };

  const setupGrokWebSocket = () => {
    grokWs.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/grok`);
    grokWs.current.onmessage = (e) => {
       const data = JSON.parse(e.data);
       if (data.alert) {
         setGrokAlert(data.alert);
       }
    };
  };

  const setupMediaAndPC = async (targetUid) => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && signalingWs.current.readyState === WebSocket.OPEN) {
        signalingWs.current.send(JSON.stringify({
          type: 'candidate',
          target_uid: targetUid,
          candidate: event.candidate
        }));
      }
    };

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      startAnalyzingRemoteStream(event.streams[0]);
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
      console.warn("Video failed, trying audio only...", e);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error("Audio failed too", err);
        return null;
      }
    }
    
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
    
    startAnalyzingLocalStream(stream);
    setupGrokWebSocket();
    setupSpeechRecognition();
    
    return peerConnection.current;
  };

  const resolveTargetUid = async () => {
    if (!targetUser) return null;
    try {
      const q = query(collection(db, "users"), where("email", "==", targetUser));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data().uid;
      }
      
      const qPhone = query(collection(db, "users"), where("phone", "==", targetUser));
      const phoneSnapshot = await getDocs(qPhone);
      if (!phoneSnapshot.empty) {
        return phoneSnapshot.docs[0].data().uid;
      }
    } catch (error) {
      console.error("Error looking up user:", error);
    }
    return null;
  };

  const startCall = async () => {
    setCallStatus('Looking up user...');
    const resolvedUid = await resolveTargetUid();
    
    if (!resolvedUid) {
      setCallStatus('Failed');
      alert("User not found. Check the email or phone number.");
      return;
    }

    setCallStatus('Calling...');
    const pc = await setupMediaAndPC(resolvedUid);
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    signalingWs.current.send(JSON.stringify({ 
      type: 'offer', 
      target_uid: resolvedUid, 
      offer 
    }));
  };

  const acceptCall = async () => {
    const { offer, caller_uid } = incomingCall;
    setIncomingCall(null);
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
    setInCall(true);
  };

  const rejectCall = () => {
    setIncomingCall(null);
    setCallStatus('Idle');
  };

  const handleEndCall = (isRemote = false) => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    
    if (speechReco.current) {
      speechReco.current.stop();
    }
    
    [localAudioContext, remoteAudioContext].forEach(ctx => {
      if (ctx.current && ctx.current.state !== 'closed') {
        ctx.current.close().catch(e => console.error(e));
      }
    });

    if (!isRemote && signalingWs.current.readyState === WebSocket.OPEN && targetUser) {
      resolveTargetUid().then(uid => {
        if (uid) {
           signalingWs.current.send(JSON.stringify({ type: 'end_call', target_uid: uid }));
        }
      });
    }

    setInCall(false);
    setCallStatus('Idle');
    setIncomingCall(null);
    setGrokAlert(null);
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

              <div className="absolute bottom-4 right-4 w-48 aspect-video bg-vox-navy border-2 border-vox-gray-dark/50 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center text-vox-gray text-xs text-center p-2">
                 <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"></video>
                 <span>(Audio Only Mode)</span>
                 <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded text-xs text-white z-10">You</div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-6 bg-vox-navy-light rounded-2xl border border-vox-gray-dark/30 p-4">
               <button onClick={() => handleEndCall(false)} className="bg-red-600 px-8 py-3 rounded-full hover:bg-red-700 text-white font-bold flex items-center gap-2"><PhoneOff size={20} /> End Call</button>
               <div className="h-8 w-px bg-vox-gray-dark/30"></div>
               <button onClick={sendChallenge} className="bg-vox-navy border border-vox-orange text-vox-orange px-6 py-3 rounded-full font-bold"><ShieldAlert size={20} className="inline mr-2"/> Issue Challenge</button>
            </div>
          </div>

          <div className="bg-vox-navy-light rounded-2xl p-5 border border-vox-gray-dark/30 flex flex-col gap-4 shadow-lg overflow-y-auto max-h-[600px]">
             <div className="pb-4 border-b border-vox-gray-dark/30">
               <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield className="text-vox-orange" size={20} /> AI Analysis</h3>
             </div>
             
             {grokAlert && (
               <div className="border border-red-500 bg-red-500/20 p-4 rounded-xl flex gap-3 animate-pulse">
                 <AlertTriangle className="text-red-500 shrink-0" />
                 <div>
                   <h4 className="font-bold text-red-500 text-sm">Grok Scam Warning</h4>
                   <p className="text-xs text-white mt-1">{grokAlert}</p>
                 </div>
               </div>
             )}

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
