import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, phone);
      }
      navigate('/protected-call');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/protected-call');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-vox-navy-light p-8 rounded-2xl border border-vox-gray-dark/30 max-w-md w-full shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <ShieldCheck size={48} className="text-vox-orange mb-4" />
          <h2 className="text-2xl font-bold text-white">{isLogin ? 'Log In to VoxGuard' : 'Create an Account'}</h2>
        </div>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded mb-6 text-sm">{error}</div>}

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-gray-900 py-3 rounded font-bold hover:bg-gray-100 transition-colors mb-6 flex items-center justify-center gap-2"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-vox-gray-dark/50"></div>
          <span className="flex-shrink-0 mx-4 text-vox-gray text-sm">or with email</span>
          <div className="flex-grow border-t border-vox-gray-dark/50"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-vox-navy border border-vox-gray-dark p-3 rounded text-white focus:outline-none focus:border-vox-orange transition-colors"
            />
          </div>
          
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input 
                type="tel" 
                required 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full bg-vox-navy border border-vox-gray-dark p-3 rounded text-white focus:outline-none focus:border-vox-orange transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-vox-navy border border-vox-gray-dark p-3 rounded text-white focus:outline-none focus:border-vox-orange transition-colors"
            />
          </div>

          <button 
            disabled={loading}
            type="submit" 
            className="w-full bg-vox-orange text-white py-3 rounded font-bold hover:bg-orange-600 transition-colors mt-4 disabled:opacity-50"
          >
            {isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-vox-orange text-sm hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
          </button>
        </div>
      </div>
    </div>
  );
}
