import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import VoiceCheck from './pages/VoiceCheck';
import ProtectedCall from './pages/ProtectedCall';
import Login from './pages/Login';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from './context/AuthContext';

function App() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-vox-navy text-vox-gray flex flex-col">
      <nav className="border-b border-vox-navy-light px-6 py-4 flex justify-between items-center overflow-x-auto whitespace-nowrap">
        <Link to="/" className="text-2xl font-bold text-vox-orange flex items-center gap-2 mr-8">
          <ShieldCheck size={28} />
          VOXGUARD
        </Link>
        <div className="flex gap-6 font-medium text-sm items-center">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <Link to="/voice-check" className="hover:text-white transition-colors">Voice Check (Mic)</Link>
          <Link to="/protected-call" className="hover:text-white transition-colors text-vox-orange">Secure Call</Link>
          
          {currentUser ? (
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-vox-gray-dark/30">
              <span className="text-xs opacity-70">
                {userData ? userData.phone || currentUser.email : currentUser.email}
              </span>
              <button onClick={handleLogout} className="text-vox-orange hover:text-white transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="ml-4 pl-4 border-l border-vox-gray-dark/30 hover:text-white transition-colors">Log In</Link>
          )}
        </div>
      </nav>
      
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/voice-check" element={<VoiceCheck />} />
          <Route path="/protected-call" element={<ProtectedCall />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
