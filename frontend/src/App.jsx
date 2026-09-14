import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Landing from './pages/Landing';
import VoiceCheck from './pages/VoiceCheck';
import ProtectedCall from './pages/ProtectedCall';
import { ShieldCheck } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-vox-navy text-vox-gray flex flex-col">
      <nav className="border-b border-vox-navy-light px-6 py-4 flex justify-between items-center overflow-x-auto whitespace-nowrap">
        <Link to="/" className="text-2xl font-bold text-vox-orange flex items-center gap-2 mr-8">
          <ShieldCheck size={28} />
          VOXGUARD
        </Link>
        <div className="flex gap-6 font-medium text-sm">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <Link to="/voice-check" className="hover:text-white transition-colors">Voice Check (Mic)</Link>
          <Link to="/protected-call" className="hover:text-white transition-colors text-vox-orange">Secure Call Platform</Link>
        </div>
      </nav>
      
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/voice-check" element={<VoiceCheck />} />
          <Route path="/protected-call" element={<ProtectedCall />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
