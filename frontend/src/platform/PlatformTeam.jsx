import React, { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askConfirm, notify } from '../components/AppFeedback';
import { Btn, Card, Empty, ErrorBox, Field, Loading, Modal, PageHead, Pill, TableWrap, Td, THead, fmtDateTime, inputCls, selectCls } from './ui';

const ROLE_HELP = {
  owner: 'Everything, including pricing, team, school logins, the audit log and every salesperson\'s pipeline.',
  developer: 'Sees only support tickets: which school and which parent reported what, with the error details. No schools, prices, billing or team.',
  sales: 'Records the schools they visit: who they met, what they pitched and quoted, and when to follow up. Sees only their own schools and the price list.',
};

const UserModal = ({ title, onClose, onDone, existing }) => {
  const [f, setF] = useState({ email: '', name: '', role: 'support', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (existing) await pApi.put(`/users/${existing.id}`, { new_password: f.password });
      else await pApi.post('/users', f);
      notify(existing ? 'Password reset. Share it with them privately.' : 'Team member added', 'success');
      onDone(); onClose();
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!existing && (<>
          <Field label="Full name"><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
          <Field label="Role" hint={ROLE_HELP[f.role]}><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputCls}>{Object.keys(ROLE_HELP).map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select></Field>
        </>)}
        <Field label={existing ? 'New temporary password' : 'Temporary password'} hint="At least 12 characters with letters and numbers. They must set up two-step verification on first sign-in, and can change the password from My account.">
          <input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} />
        </Field>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800">{error}</p>}
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>{existing ? 'Reset password' : 'Add member'}</Btn></div>
      </form>
    </Modal>
  );
};

export const TeamPage = () => {
  const { can, user: me } = usePlatform();
  const editable = can('team:write');
  const { data, loading, error, reload } = useFetch('/users');
  const [modal, setModal] = useState(null);
  const act = async (id, body, okText) => {
    try { await pApi.put(`/users/${id}`, body); notify(okText, 'success'); reload(); } catch (err) { notify(errText(err), 'error'); }
  };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <>
      <PageHead title="Team" subtitle="People who can sign in to the platform admin." actions={editable && <Btn onClick={() => setModal({ kind: 'add' })}><Plus className="h-4 w-4" />Add team member</Btn>} />
      <TableWrap>
        <THead cols={['Name', 'Role', 'Two-step', 'Last sign-in', 'Status', '']} />
        <tbody>
          {data.map((u) => (
            <tr key={u.id}>
              <Td><span className="font-semibold">{u.name}</span>{u.id === me.id && <span className="ml-2 text-[12px] text-[#6B7080]">(you)</span>}<div className="text-[12.5px] text-[#6B7080]">{u.email}</div></Td>
              <Td>{editable && u.id !== me.id ? (
                <select value={u.role} onChange={(e) => act(u.id, { role: e.target.value }, 'Role updated')} className={`${inputCls} h-9 w-32`} aria-label={`Role of ${u.name}`}>{Object.keys(ROLE_HELP).map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select>
              ) : <Pill tone="indigo">{u.role}</Pill>}</Td>
              <Td>{u.totp_enabled ? <Pill tone="green">On</Pill> : <Pill tone="amber">Not set up</Pill>}</Td>
              <Td>{fmtDateTime(u.last_login)}</Td>
              <Td>{u.active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Deactivated</Pill>}</Td>
              <Td className="whitespace-nowrap text-right">{editable && u.id !== me.id && (<>
                <button onClick={() => setModal({ kind: 'reset', user: u })} className="mr-3 text-[13px] font-medium text-[#3F3A8C] hover:underline">Reset password</button>
                {u.totp_enabled && <button onClick={async () => { if (await askConfirm(`Reset two-step verification for ${u.name}? They will set it up again at next sign-in.`)) act(u.id, { reset_2fa: true }, 'Two-step reset'); }} className="mr-3 text-[13px] font-medium text-[#3F3A8C] hover:underline">Reset 2FA</button>}
                <button onClick={async () => { if (!u.active || await askConfirm(`Deactivate ${u.name}? They will be signed out of the platform.`)) act(u.id, { active: !u.active }, u.active ? 'Deactivated' : 'Reactivated'); }} className={`text-[13px] font-medium hover:underline ${u.active ? 'text-red-700' : 'text-emerald-700'}`}>{u.active ? 'Deactivate' : 'Reactivate'}</button></>)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Object.entries(ROLE_HELP).map(([r, text]) => <Card key={r} title={r[0].toUpperCase() + r.slice(1)}><p className="text-[13.5px] text-[#5B6070]">{text}</p></Card>)}
      </div>
      {modal?.kind === 'add' && <UserModal title="Add a team member" onClose={() => setModal(null)} onDone={reload} />}
      {modal?.kind === 'reset' && <UserModal title={`Reset password for ${modal.user.name}`} existing={modal.user} onClose={() => setModal(null)} onDone={reload} />}
    </>
  );
};

export const AuditPage = () => {
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const { data, loading, error, reload } = useFetch('/audit', { action, actor, limit: 300 });
  const actions = ['login', 'login_failed', 'login_blocked', 'logout', 'password_changed', '2fa_enabled', 'user_created', 'user_updated', 'school_created', 'school_updated', 'school_plan_changed', 'school_status_changed', 'school_features_changed', 'plan_pricing_updated', 'billing_settings_updated', 'invoice_created', 'invoice_status_changed', 'ticket_updated', 'ticket_reply', 'ticket_note', 'lead_created', 'lead_updated', 'lead_activity', 'lead_converted', 'school_password_set', 'school_login_updated'];
  return (
    <>
      <PageHead title="Audit log" subtitle="Every sign-in and every change made in the platform admin. It cannot be edited." />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={action} onChange={(e) => setAction(e.target.value)} className={`${selectCls} w-64`} aria-label="Action"><option value="">All actions</option>{actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select>
        <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Filter by person (email)" className={`${selectCls} w-64`} />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? <Card><Empty>Nothing recorded for these filters.</Empty></Card> : (
        <TableWrap>
          <THead cols={['When', 'Who', 'Action', 'Target', 'Details', 'IP']} />
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <Td className="whitespace-nowrap">{fmtDateTime(row.at)}</Td>
                <Td>{row.actor || '—'}</Td>
                <Td><Pill tone={/failed|blocked/.test(row.action) ? 'red' : 'gray'}>{row.action.replace(/_/g, ' ')}</Pill></Td>
                <Td className="max-w-[160px] truncate">{row.target}</Td>
                <Td className="max-w-[320px] break-words text-[12.5px] text-[#5B6070]">{typeof row.detail === 'object' ? JSON.stringify(row.detail) : row.detail}</Td>
                <Td className="text-[12.5px] text-[#6B7080]">{row.ip}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
};

export const AccountPage = () => {
  const { user, refresh } = usePlatform();
  const [name, setName] = useState(user.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const saveName = async (e) => {
    e.preventDefault(); setNameError(''); setNameBusy(true);
    try { await pApi.put('/auth/me', { name }); await refresh(); notify('Your name was updated', 'success'); } catch (err) { setNameError(errText(err)); } finally { setNameBusy(false); }
  };
  const [f, setF] = useState({ current_password: '', new_password: '', repeat: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.new_password !== f.repeat) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await pApi.post('/auth/change-password', { current_password: f.current_password, new_password: f.new_password });
      notify('Password changed', 'success'); setF({ current_password: '', new_password: '', repeat: '' });
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="My account" subtitle={`${user.name} · ${user.email} · ${user.role}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Your details" subtitle="Your name is used in the greeting and wherever your work is recorded.">
          <form onSubmit={saveName} className="space-y-4">
            <Field label="Your name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className={inputCls} /></Field>
            <Field label="Email" hint="Your sign-in email. Ask an Owner if it has to change."><input value={user.email} disabled className={inputCls} /></Field>
            <Field label="Role"><input value={user.role[0].toUpperCase() + user.role.slice(1)} disabled className={inputCls} /></Field>
            {nameError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800">{nameError}</p>}
            <Btn type="submit" busy={nameBusy} disabled={name.trim() === user.name}>Save my name</Btn>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Current password"><input type="password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} className={inputCls} /></Field>
            <Field label="New password" hint="At least 12 characters with letters and numbers."><input type="password" autoComplete="new-password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} className={inputCls} /></Field>
            <Field label="Repeat new password"><input type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} className={inputCls} /></Field>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800">{error}</p>}
            <Btn type="submit" busy={busy}>Change password</Btn>
          </form>
        </Card>
        <Card title="Two-step verification">
          <p className="flex items-center gap-2 text-[14px]"><ShieldCheck className="h-5 w-5 text-emerald-600" />{user.totp_enabled ? 'On. Your authenticator app is required at every sign-in.' : 'Not set up.'}</p>
          <p className="mt-3 text-[13px] text-[#5B6070]">Lost your phone? Ask an Owner to reset it for you from the Team page. If you are the only Owner, run <code>python create_platform_owner.py</code> on the server.</p>
        </Card>
      </div>
    </>
  );
};
