import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, ArrowRight, BookOpen, Boxes, Briefcase, ChevronRight, Crown, Eye, EyeOff, GraduationCap, KeyRound,
  Loader2, LockKeyhole, Mail, Phone, ShieldCheck, Wallet,
} from 'lucide-react';

const roles = [
  { label: 'Admin', role: 'admin', group: 'School office', icon: ShieldCheck, description: 'Admissions, front office, settings and every module' },
  { label: 'Director', role: 'director', group: 'School office', icon: Crown, description: 'Approvals, branch reports and school performance' },
  { label: 'Academic Coordinator', role: 'academic_coordinator', group: 'Classrooms', icon: Briefcase, description: 'Exams, syllabus, attendance and student support' },
  { label: 'Class Teacher', role: 'teacher', group: 'Classrooms', icon: GraduationCap, description: 'Your class register, marks and homework' },
  { label: 'Fee Manager', role: 'fee_manager', group: 'Accounts & stores', icon: Wallet, description: 'Fee collection, receipts, expenses and payroll' },
  { label: 'Stock Manager', role: 'stock_manager', group: 'Accounts & stores', icon: Boxes, description: 'Uniforms, books, purchases and stock register' },
  { label: 'Librarian', role: 'librarian', group: 'Accounts & stores', icon: BookOpen, description: 'Book catalogue, loans and late fines' },
];
const GROUPS = ['School office', 'Classrooms', 'Accounts & stores'];
const serif = { fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

const RoleIcon = ({ item, large = false }) => {
  const Icon = item.icon;
  return <span className={`flex shrink-0 items-center justify-center rounded-lg border border-[#E4E0D6] bg-[#FAF8F3] text-[#3F3A8C] ${large ? 'h-11 w-11' : 'h-9 w-9'}`}><Icon className={large ? 'h-5 w-5' : 'h-[18px] w-[18px]'} strokeWidth={1.75} /></span>;
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState('role');
  const [method, setMethod] = useState('password');
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const selectRole = (item) => {
    setSelectedRole(item);
    setStep('credentials');
    setMethod('password');
    setLoginError('');
  };

  const completeLogin = async (credentials = {}) => {
    setLoading(true);
    setLoginError('');
    try {
      await login(selectedRole.role, credentials);
      navigate('/dashboard');
    } catch (error) {
      setLoginError(error?.response?.data?.detail || 'Unable to sign in. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordLogin = async (event) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setLoginError('Enter a valid registered email address.');
    if (password.length < 6) return setLoginError('Enter your password. It must contain at least 6 characters.');
    await completeLogin({ email: email.trim(), password });
  };

  const sendOtp = (event) => {
    event?.preventDefault();
    const digits = mobile.replace(/\D/g, '');
    if (digits.length !== 10) return setLoginError('Enter a valid registered 10-digit mobile number.');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setDemoOtp(code);
    setOtp('');
    setLoginError('');
    setStep('otp');
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (otp !== demoOtp) return setLoginError('The OTP is incorrect. Please check the code and try again.');
    await completeLogin({ mobile: mobile.replace(/\D/g, ''), otp });
  };

  const chooseMethod = (next) => {
    setMethod(next);
    setLoginError('');
    setOtp('');
    setStep('credentials');
  };

  const back = () => {
    setLoginError('');
    if (step === 'otp') {
      setStep('credentials');
      return;
    }
    setStep('role');
    setSelectedRole(null);
    setEmail('');
    setPassword('');
    setMobile('');
  };

  const inputCls = 'w-full rounded-lg border border-[#DAD6CC] bg-white py-3 pl-10 pr-4 text-[14.5px] text-[#1F2433] outline-none transition placeholder:text-[#A09B90] focus:border-[#3F3A8C] focus:ring-2 focus:ring-[#3F3A8C]/15';
  const primaryBtn = 'flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2E2A6E] px-4 text-[14px] font-semibold text-white transition hover:bg-[#252160] disabled:opacity-60';
  const label = 'block text-[13px] font-medium text-[#4A4F5C]';

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#1F2433]">
      <div className="mx-auto grid min-h-screen max-w-[1180px] grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Left: school-office welcome */}
        <section className="hidden flex-col justify-between border-r border-[#E2DDD1] px-12 py-12 lg:flex">
          <img src="/orison-logo.svg" alt="Orison Services Pvt. Ltd." className="h-12 w-auto self-start object-contain" />
          <div className="max-w-[440px]">
            <p className="text-[13px] font-medium text-[#8A8475]">{today()}</p>
            <h1 style={serif} className="mt-3 text-[52px] font-medium leading-[1.05] tracking-[-0.02em] text-[#1F2433]">{greeting()}.</h1>
            <p className="mt-5 text-[16px] leading-7 text-[#5B6070]">Sign in to your school's office, classrooms and fee desk — all kept in one register, so every teacher, accountant and parent sees the same record.</p>
            <div className="mt-10 space-y-4 border-l-2 border-[#3F3A8C]/25 pl-5">
              {[
                ['Attendance reaches parents the same morning', 'Marked in class, sent to the parent app before first break.'],
                ['Fee receipts that match the bank', 'Every payment, concession and refund has one receipt number.'],
                ['Your data stays with your school', 'Each login sees only what that role needs.'],
              ].map(([t, d]) => <div key={t}><p className="text-[14px] font-semibold text-[#2B3040]">{t}</p><p className="mt-0.5 text-[13.5px] leading-6 text-[#6B7080]">{d}</p></div>)}
            </div>
          </div>
          <p className="text-[12.5px] text-[#8A8475]">Trouble signing in? Ask your school admin to reset your access.</p>
        </section>

        {/* Right: sign-in */}
        <section className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[460px]">
            <img src="/orison-logo.svg" alt="Orison" className="mb-8 h-10 w-auto lg:hidden" />

            {step === 'role' ? <div key="role">
              <h2 style={serif} className="text-[30px] font-medium leading-tight tracking-[-0.01em]">Who's signing in?</h2>
              <p className="mt-2 text-[14.5px] text-[#6B7080]">Choose the role your school gave you.</p>

              <div className="mt-7 overflow-hidden rounded-xl border border-[#E2DDD1] bg-white">
                {GROUPS.map((group, gi) => <div key={group}>
                  <p className={`bg-[#FAF8F3] px-4 py-2 text-[12px] font-semibold text-[#8A8475] ${gi ? 'border-t border-[#ECE8DF]' : ''}`}>{group}</p>
                  {roles.filter((r) => r.group === group).map((item) => <button key={item.role} data-testid={`role-${item.role}`} onClick={() => selectRole(item)} className="group flex w-full items-center gap-3.5 border-t border-[#ECE8DF] px-4 py-3 text-left transition hover:bg-[#F7F5FF] focus:bg-[#F7F5FF] focus:outline-none">
                    <RoleIcon item={item} />
                    <span className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold text-[#1F2433]">{item.label}</b><span className="block text-[13px] leading-5 text-[#767B8A]">{item.description}</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#BDB8AC] transition group-hover:translate-x-0.5 group-hover:text-[#3F3A8C]" />
                  </button>)}
                </div>)}
              </div>
            </div> : <div key={step}>
              <button onClick={back} className="mb-7 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#5B6070] hover:text-[#1F2433]"><ArrowLeft className="h-4 w-4" />{step === 'otp' ? 'Change number' : 'Back to roles'}</button>
              <div className="flex items-center gap-3.5"><RoleIcon item={selectedRole} large /><div><p className="text-[13px] text-[#8A8475]">Signing in as</p><p className="text-[16px] font-semibold">{selectedRole?.label}</p></div></div>
              <h2 style={serif} className="mt-6 text-[28px] font-medium leading-tight">{step === 'otp' ? 'Enter the code we sent' : method === 'password' ? 'Sign in with your email' : 'Sign in with your mobile'}</h2>
              {step === 'otp' && <p className="mt-2 text-[14px] text-[#6B7080]">A six-digit code was sent to <b className="text-[#1F2433]">+91 {mobile}</b>.</p>}

              {step === 'credentials' && <>
                {method === 'password' ? <form onSubmit={passwordLogin} className="mt-6 space-y-4">
                  <label className={label}>Email address<div className="relative mt-1.5"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09B90]" /><input autoFocus type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@school.in" className={inputCls} /></div></label>
                  <label className={label}><span className="flex items-center justify-between">Password<button type="button" className="text-[13px] font-medium text-[#3F3A8C] hover:underline">Forgot password?</button></span><div className="relative mt-1.5"><LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09B90]" /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" className={`${inputCls} pr-11`} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A09B90] hover:text-[#5B6070]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
                  <button disabled={loading} className={primaryBtn}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}</button>
                </form> : <form onSubmit={sendOtp} className="mt-6">
                  <label className={label}>Mobile number<div className="relative mt-1.5"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#5B6070]">+91</span><input autoFocus inputMode="numeric" maxLength={10} value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className={`${inputCls} pl-12`} /></div></label>
                  <button className={`${primaryBtn} mt-5`}>Send code <ArrowRight className="h-4 w-4" /></button>
                </form>}
                <div className="my-6 flex items-center gap-3 text-[12.5px] text-[#A09B90]"><span className="h-px flex-1 bg-[#E2DDD1]" />or<span className="h-px flex-1 bg-[#E2DDD1]" /></div>
                <button onClick={() => chooseMethod(method === 'password' ? 'otp' : 'password')} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#DAD6CC] bg-white text-[14px] font-medium text-[#2B3040] transition hover:border-[#BDB8AC]">{method === 'password' ? <><Phone className="h-4 w-4" />Use a one-time code on my mobile</> : <><Mail className="h-4 w-4" />Use my email and password</>}</button>
              </>}

              {step === 'otp' && <form onSubmit={verifyOtp} className="mt-6">
                <div className="relative"><KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09B90]" /><input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className={`${inputCls} h-14 text-center text-[22px] font-semibold tracking-[0.45em]`} /></div>
                <p className="mt-3 rounded-lg border border-[#EADFC4] bg-[#FBF6E9] px-3.5 py-2.5 text-[12.5px] leading-5 text-[#7A6326]">Test code: <b>{demoOtp}</b> — this note disappears once SMS is connected.</p>
                <button disabled={loading || otp.length !== 6} className={`${primaryBtn} mt-4`}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" />Checking…</> : <>Verify and sign in <ArrowRight className="h-4 w-4" /></>}</button>
                <p className="mt-4 text-center text-[13px] text-[#6B7080]">Didn't get it? <button type="button" onClick={sendOtp} className="font-medium text-[#3F3A8C] hover:underline">Send again</button></p>
              </form>}
            </div>}

            {loginError && <div role="alert" className="mt-4 rounded-lg border border-[#F1C9C4] bg-[#FDF1EF] px-4 py-3 text-[13.5px] leading-5 text-[#9A3B2E]">{loginError}</div>}

            <p className="mt-8 flex items-center gap-2 text-[12.5px] text-[#8A8475]"><LockKeyhole className="h-3.5 w-3.5" />Secure, role-based access · © 2026 Orison Services Pvt. Ltd.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
