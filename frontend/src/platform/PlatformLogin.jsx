import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import pApi, { errText, getToken, setToken } from './platformApi';
import { Btn, Field, inputCls, serif } from './ui';
import { usePlatform } from './platformContext';

const Frame = ({ title, subtitle, children }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#F4F1EA] px-4 py-10 text-[#1F2433]">
    <div className="w-full max-w-[440px]">
      <p style={serif} className="text-center text-[34px] text-[#2E2A6E]">orison</p>
      <p className="mb-8 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6B7080]">Platform admin</p>
      <div className="rounded-2xl border border-[#E2DDD1] bg-white p-8 shadow-sm">
        <h1 style={serif} className="text-[26px] font-medium">{title}</h1>
        <p className="mb-6 mt-1 text-[14px] text-[#5B6070]">{subtitle}</p>
        {children}
      </div>
      <p className="mt-6 text-center text-[12.5px] text-[#6B7080]">For Orison team members only. School staff sign in from the school login.</p>
    </div>
  </div>
);

export const PlatformLogin = () => {
  const navigate = useNavigate();
  const { user, needs2fa, loading, refresh } = usePlatform();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  if (!loading && user) return <Navigate to={needs2fa ? '/platform/setup-2fa' : '/platform'} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const { data } = await pApi.post('/auth/login', { email: form.email.trim(), password: form.password, otp: form.otp.replace(/\s/g, '') });
      setToken(data.token);
      await refresh();
      navigate(data.needs_2fa_setup ? '/platform/setup-2fa' : '/platform', { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title="Sign in" subtitle="Use your Orison platform account.">
      <form onSubmit={submit} className="space-y-4" data-testid="platform-login-form">
        <Field label="Email"><input type="email" autoComplete="username" autoFocus value={form.email} onChange={set('email')} className={inputCls} /></Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={set('password')} className={`${inputCls} pr-11`} />
            <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8F9C]">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
        <Field label="Authenticator code" hint="6 digits from your authenticator app. Leave empty on your very first sign-in, before two-step is set up.">
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={form.otp} onChange={set('otp')} placeholder="000000" className={`${inputCls} tracking-[0.3em]`} />
        </Field>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800">{error}</p>}
        <Btn type="submit" busy={busy} className="w-full">Sign in</Btn>
      </form>
    </Frame>
  );
};

export const SetupTwoFactor = () => {
  const navigate = useNavigate();
  const { user, loading, refresh, signOut } = usePlatform();
  const [setup, setSetup] = useState(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !getToken()) return;
    let alive = true;
    pApi.post('/auth/2fa/setup').then(({ data }) => { if (alive) setSetup(data); })
      .catch((err) => { if (alive) setError(errText(err)); });
    return () => { alive = false; };
  }, [loading]);

  if (!loading && !user) return <Navigate to="/platform/login" replace />;

  const confirm = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await pApi.post('/auth/2fa/enable', { otp: otp.replace(/\s/g, '') });
      setToken(data.token);
      await refresh();
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const grouped = setup ? setup.secret.match(/.{1,4}/g).join(' ') : '';
  return (
    <Frame title="Set up two-step verification" subtitle="Required for every platform account. It protects every school's contract and billing data.">
      <ol className="mb-5 space-y-3 text-[14px] leading-6 text-[#2B3040]">
        <li><b>1.</b> Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).</li>
        <li><b>2.</b> Add an account, choose <i>Enter a setup key</i>, and type this key:</li>
      </ol>
      <div className="mb-3 rounded-lg border border-[#E2DDD1] bg-[#FAF8F3] px-4 py-3 text-center font-mono text-[17px] tracking-wider" data-testid="totp-secret">{grouped || '…'}</div>
      {setup && <a href={setup.otpauth_uri} className="mb-5 block text-center text-[13px] font-medium text-[#3F3A8C] underline">Open in my authenticator app (on this phone)</a>}
      <form onSubmit={confirm} className="space-y-4">
        <Field label="3. Enter the 6-digit code the app shows"><input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" className={`${inputCls} tracking-[0.3em]`} /></Field>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800">{error}</p>}
        <Btn type="submit" busy={busy} disabled={!setup} className="w-full"><ShieldCheck className="h-4 w-4" />Turn on two-step verification</Btn>
      </form>
      <button onClick={async () => { await signOut(); navigate('/platform/login'); }} className="mt-4 block w-full text-center text-[13px] text-[#6B7080] underline">Sign out</button>
    </Frame>
  );
};
