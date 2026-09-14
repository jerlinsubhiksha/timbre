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
  
  const { login, signup } = useAuth();
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

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-vox-navy-light p-8 rounded-2xl border border-vox-gray-dark/30 max-w-md w-full shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={48} className="text-vox-orange mb-4" />
          <h2 className="text-2xl font-bold text-white">{isLogin ? 'Log In to VoxGuard' : 'Create an Account'}</h2>
          <p className="text-sm text-vox-gray text-center mt-2">
            {isLogin ? 'Enter your credentials to securely make calls.' : 'Register to get a unique VoxGuard phone number.'}
          </p>
        </div>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded mb-6 text-sm">{error}</div>}

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
