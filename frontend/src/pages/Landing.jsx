import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic, ShieldAlert, Activity } from 'lucide-react';

export default function Landing() {
  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-vox-orange opacity-5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto px-6 text-center z-10">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight"
        >
          Can You Trust <br/>
          <span className="text-vox-orange">The Voice?</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-vox-gray mb-10 max-w-2xl mx-auto"
        >
          Real-time AI detection for cloned, synthetic, converted, and replayed voices. Stop impersonation before it happens.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link to="/voice-check" className="bg-vox-orange hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-full flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
            <Mic size={20} /> Start Voice Check
          </Link>
          <Link to="/protected-call" className="bg-vox-navy-light border border-vox-gray-dark hover:border-white text-white font-bold py-4 px-8 rounded-full flex items-center justify-center gap-2 transition-all hover:scale-105">
            <ShieldAlert size={20} /> Start Protected Call
          </Link>
        </motion.div>
        
        {/* Animated Waveform Demo */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-20 flex justify-center items-center gap-8 opacity-80"
        >
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold text-green-400 mb-4">Human Voice</span>
            <div className="flex gap-1 h-12 items-end">
              {[1, 3, 2, 4, 2, 5, 3, 1, 4].map((h, i) => (
                <motion.div 
                  key={i} 
                  className="w-1.5 bg-green-400 rounded-t-sm"
                  animate={{ height: [h*4, h*8, h*4] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                />
              ))}
            </div>
            <span className="text-xs mt-3 bg-green-400/20 px-2 py-1 rounded">Authentic</span>
          </div>
          
          <Activity className="text-vox-gray-dark" />
          
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold text-vox-orange mb-4">Cloned Voice</span>
            <div className="flex gap-1 h-12 items-end">
              {[5, 4, 5, 4, 5, 4, 5, 4, 5].map((h, i) => (
                <motion.div 
                  key={i} 
                  className="w-1.5 bg-vox-orange rounded-t-sm"
                  animate={{ height: [h*8, h*6, h*8] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                />
              ))}
            </div>
            <span className="text-xs mt-3 bg-vox-orange/20 px-2 py-1 rounded">Threat Alert</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
