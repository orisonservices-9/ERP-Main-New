import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OrisonLogo from '../components/OrisonLogo';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

const roles = [
  { label: 'Login as Admin', role: 'admin' },
  { label: 'Login as Director', role: 'director' },
  { label: 'Login as Academic Coordinator', role: 'academic_coordinator' },
  { label: 'Login as Fee Manager', role: 'fee_manager' },
];

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState('');
  const [loginError, setLoginError] = useState('');

  const handle = async (role) => {
    setLoginError('');
    setLoading(role);
    try {
      await login(role);
      navigate('/dashboard');
    } catch (e) {
      setLoading('');
      setLoginError(
        e?.response?.data?.detail ||
        'The school server is unavailable. Please start the backend and try again.'
      );
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F7F8FC] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-[-100px] h-[400px] w-[400px] rounded-full bg-indigo-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-[-100px] h-[360px] w-[360px] rounded-full bg-indigo-100/60 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl items-center justify-center">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-[28px] border border-white bg-white/85 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl md:grid-cols-[1.05fr_0.95fr]">
          <section className="relative overflow-hidden bg-gradient-to-br from-[#081126] via-[#111B3E] to-[#312E81] p-9 text-white md:p-12">
            <div className="absolute right-[-65px] top-[-55px] h-56 w-56 rounded-full border border-white/10" />
            <div className="absolute bottom-[-100px] left-[-90px] h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-100"><Sparkles className="h-3.5 w-3.5" /> Premium school workspace</span>
              <div className="mt-10"><OrisonLogo size="lg" /></div>
              <h1 className="mt-10 font-poppins text-3xl font-bold leading-tight tracking-[-0.04em]">Every school decision, <span className="text-indigo-300">clearly connected.</span></h1>
              <p className="mt-4 max-w-sm text-[13px] leading-6 text-white/65">A single, secure workspace for academics, people, finance, parent communication and daily operations.</p>
              <div className="mt-10 space-y-3">
                {['Live operational visibility', 'Role-based secure access', 'One source of school data'].map((item) => <div key={item} className="flex items-center gap-3 text-[12px] font-medium text-white/80"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /></span>{item}</div>)}
              </div>
            </div>
          </section>
          <section className="flex flex-col justify-center p-8 sm:p-10 md:p-12">
            <div className="mb-8"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]"><ShieldCheck className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Secure access</p><h2 className="mt-2 font-poppins text-2xl font-bold tracking-[-0.03em] text-slate-900">Choose your workspace</h2><p className="mt-2 text-[12px] leading-5 text-slate-500">Sign in with your assigned role to continue.</p></div>
        <div className="flex flex-col gap-2.5">
          {roles.map((r) => (
            <button
              key={r.role}
              onClick={() => handle(r.role)}
              disabled={loading}
              className="group w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-4 text-left text-[12px] font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4338CA] hover:shadow-md active:translate-y-0 disabled:opacity-70 flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[9px] font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-[#4338CA]">{r.label.replace('Login as ', '').slice(0, 2).toUpperCase()}</span>{r.label.replace('Login as ', '')}</span>
              {loading === r.role ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#4338CA]" />}
            </button>
          ))}
        </div>
        {loginError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-medium leading-5 text-red-700">
            {loginError}
          </div>
        )}
        <p className="mt-7 text-center text-[10px] text-slate-400">Protected school data • Authorized access only</p>
          </section>
        </div>
      </div>
      <p className="absolute bottom-5 left-0 right-0 text-center text-[10px] text-slate-400">© 2026 Orison Services Pvt. Ltd. • School Operations Platform</p>
    </div>
  );
};

export default Login;
