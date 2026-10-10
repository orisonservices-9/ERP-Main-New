import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OrisonLogo from '../components/OrisonLogo';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const roles = [
  { label: 'Login as Admin', role: 'admin' },
  { label: 'Login as principal', role: 'principal' },
  { label: 'Login as Fee Manager', role: 'fee_manager' },
];

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState('');

  const handle = async (role) => {
    setLoading(role);
    try {
      await login(role);
      navigate('/dashboard');
    } catch (e) {
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f2f2f2] px-4 relative">
      <div className="flex flex-col items-center">
        <div className="mb-10"><OrisonLogo size="lg" /></div>
        <div className="flex flex-col gap-4 w-[280px]">
          {roles.map((r) => (
            <button
              key={r.role}
              onClick={() => handle(r.role)}
              disabled={loading}
              className="w-full h-[52px] rounded-full bg-[#C4141B] hover:bg-[#a91116] text-white font-poppins font-medium text-[16px] shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading === r.role && <Loader2 className="w-4 h-4 animate-spin" />}
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="absolute bottom-8 text-[12px] text-[#9a9a9a]">© Copyright 2025 Orison services</p>
    </div>
  );
};

export default Login;
