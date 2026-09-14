import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VoiceCheck() {
  const [micState, setMicState] = useState('idle'); // idle, calibrating, listening, error
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const ws = useRef(null);
  const audioContext = useRef(null);
  const mediaStream = useRef(null);
  const processor = useRef(null);

  // Audio visualization
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, []);

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      
      ctx.fillStyle = '#0A1128';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#F97316';
      ctx.beginPath();
      
      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height/2;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height/2);
      ctx.stroke();
    };
    draw();
  };

  const startMic = async () => {
    try {
      setMicState('calibrating');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      
      mediaStream.current = stream;
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContext.current.createMediaStreamSource(stream);
      
      // Setup Visualizer
      analyserRef.current = audioContext.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      drawWaveform();

      // Connect WebSocket
      ws.current = new WebSocket(`ws://${window.location.hostname}:8000/ws/analyze`);
      
      ws.current.onopen = () => {
        setMicState('listening');
        // Setup Audio Processor
        processor.current = audioContext.current.createScriptProcessor(4096, 1, 1);
        source.connect(processor.current);
        processor.current.connect(audioContext.current.destination);
        
        processor.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          if (ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(inputData.buffer);
          }
        };
      };
      
      ws.current.onmessage = (event) => {
        setResults(JSON.parse(event.data));
      };
      
      ws.current.onerror = () => {
        setErrorMsg('Failed to connect to backend server. Make sure it is running.');
        stopMic();
      };

    } catch (err) {
      console.error(err);
      setMicState('error');
      setErrorMsg('Microphone permission denied or device not found.');
    }
  };

  const stopMic = () => {
    if (processor.current) processor.current.disconnect();
    if (audioContext.current) audioContext.current.close();
    if (mediaStream.current) mediaStream.current.getTracks().forEach(t => t.stop());
    if (ws.current) ws.current.close();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    setMicState('idle');
    setResults(null);
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-6">
      <h2 className="text-3xl font-bold text-white mb-8">Real-Time Voice Check</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Col: Controls & Viz */}
        <div className="bg-vox-navy-light rounded-2xl p-6 border border-vox-gray-dark/30">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-white">Audio Input</h3>
            <div className="flex items-center gap-2">
               <span className="text-sm">Status:</span>
               <span className={`px-2 py-1 rounded text-xs font-bold ${
                 micState === 'listening' ? 'bg-green-500/20 text-green-400' : 
                 micState === 'calibrating' ? 'bg-yellow-500/20 text-yellow-400' : 
                 'bg-vox-gray-dark/20 text-vox-gray'
               }`}>
                 {micState.toUpperCase()}
               </span>
            </div>
          </div>
          
          <div className="bg-vox-navy rounded-xl h-40 mb-6 flex items-center justify-center overflow-hidden border border-vox-gray-dark/20">
            {micState !== 'idle' ? (
              <canvas ref={canvasRef} width="400" height="160" className="w-full h-full" />
            ) : (
              <p className="text-vox-gray-dark">Microphone inactive</p>
            )}
          </div>
          
          {errorMsg && <p className="text-vox-orange text-sm mb-4">{errorMsg}</p>}

          {micState === 'idle' || micState === 'error' ? (
            <button onClick={startMic} className="w-full bg-vox-orange hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <Mic size={20} /> Start Analysis
            </button>
          ) : (
            <button onClick={stopMic} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <MicOff size={20} /> Stop Recording
            </button>
          )}
        </div>

        {/* Right Col: Results Dashboard */}
        <div className="bg-vox-navy-light rounded-2xl p-6 border border-vox-gray-dark/30">
          <h3 className="text-xl font-semibold text-white mb-6">Live AI Assessment</h3>
          
          {!results ? (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-vox-gray-dark">
              <ShieldAlert size={48} className="mb-4 opacity-50" />
              <p>Waiting for voice data...</p>
            </div>
          ) : (
            <div className="space-y-6">
               <div className={`p-4 rounded-xl border ${results.final_classification === 'UNCERTAIN' ? 'border-yellow-500 bg-yellow-500/10' : results.final_classification === 'AI / SYNTHETIC' ? 'border-vox-orange bg-vox-orange/10' : 'border-green-500 bg-green-500/10'}`}>
                 <h4 className="text-sm font-semibold opacity-80 mb-1">VOICE AUTHENTICITY</h4>
                 <p className={`text-2xl font-bold ${results.final_classification === 'UNCERTAIN' ? 'text-yellow-500' : results.final_classification === 'AI / SYNTHETIC' ? 'text-vox-orange' : 'text-green-400'}`}>
                   {results.final_classification}
                 </p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-vox-navy p-3 rounded-xl">
                   <p className="text-xs opacity-60">Speech Detected</p>
                   <p className="text-lg font-semibold">{results.speech_detected ? 'Yes' : 'No'}</p>
                 </div>
                 <div className="bg-vox-navy p-3 rounded-xl">
                   <p className="text-xs opacity-60">Background Noise</p>
                   <p className="text-lg font-semibold">{results.noise_level}</p>
                 </div>
                 <div className="bg-vox-navy p-3 rounded-xl col-span-2">
                   <p className="text-xs opacity-60">AI/Synthetic Model Status</p>
                   <p className="text-sm font-semibold text-vox-orange">{results.model_status}</p>
                   <p className="text-xs opacity-80 mt-1">{results.details}</p>
                 </div>
               </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
