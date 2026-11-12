import React, { useState } from 'react';
import { Banknote, Building2, Handshake, LifeBuoy, Plus, ShieldCheck, Users, Wallet } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askConfirm, notify } from '../components/AppFeedback';
import { Btn, Card, Empty, ErrorBox, Field, Loading, Modal, PageHead, Pill, TableWrap, Td, THead, fmtDateTime, inputCls, selectCls } from './ui';

const ROLE_HELP = {
  owner: 'Sees everything and decides prices, salaries and who is on the team. Reviews the sales team and the accounts. Does not add schools, approve travel or pay anyone: Sales and Accounts do that.',
  developer: 'Sees only support tickets: which school and which parent reported what, with the error details. No schools, prices, billing or team.',
  accounts: 'Checks the sales team\'s kilometres and expenses, raises invoices, records payments from schools for the ERP and other products, follows up on what school leaders promised, and sends the monthly report to the owner. Cannot see leads, school settings, school logins, tickets or the team.',
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

// ---------------------------------------------------------------- the audit log: a plain-language diary of who did what
const AREAS = {
  Security: { color: '#6B7080', bg: '#F0EEE8', icon: ShieldCheck },
  Schools: { color: '#3157C8', bg: '#E8EEFB', icon: Building2 },
  Sales: { color: '#C2410C', bg: '#FDEEE3', icon: Handshake },
  Money: { color: '#047857', bg: '#E1F4EA', icon: Wallet },
  Salaries: { color: '#6D3FA8', bg: '#F0E8FA', icon: Banknote },
  Support: { color: '#0E7490', bg: '#E0F2F6', icon: LifeBuoy },
  Team: { color: '#B45309', bg: '#FBF0DC', icon: Users },
};
const R = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const LABELS = {
  login: ['Security', () => 'signed in'], login_failed: ['Security', () => 'had a wrong password or code when signing in'], login_blocked: ['Security', () => 'was blocked after too many wrong attempts'],
  logout: ['Security', () => 'signed out'], password_changed: ['Security', () => 'changed their password'], '2fa_enabled': ['Security', () => 'turned on two-step verification'], profile_updated: ['Security', () => 'changed their name'],
  user_created: ['Team', (d, r) => `added ${d.email || r.target} to the team${d.role ? ` as ${d.role}` : ''}`], user_updated: ['Team', (d, r) => `changed the login of ${d.email || r.target}${d.role ? ` (role: ${d.role})` : ''}${d.active === false ? ' (switched off)' : ''}`],
  school_created: ['Schools', (d) => `added the school ${d.name || ''}`], school_updated: ['Schools', (d, r) => `edited the school ${d.name || r.target}`], school_plan_changed: ['Schools', (d, r) => `changed the plan of ${r.target}${d.to ? ` to ${d.to}` : ''}`],
  school_status_changed: ['Schools', (d, r) => `changed the status of ${r.target}${d.to ? ` to ${d.to}` : ''}`], school_features_changed: ['Schools', (d, r) => `changed the features of ${r.target}`], school_access_changed: ['Schools', (d, r) => `changed which logins ${r.target} has`],
  school_login_updated: ['Schools', (d, r) => `updated a school login of ${r.target}`], school_password_set: ['Schools', (d, r) => `set a new password for a school login of ${r.target}`], plan_pricing_updated: ['Money', (d, r) => `changed the price of the ${r.target} plan`],
  billing_settings_updated: ['Money', (d) => `changed billing settings${d.km_rate !== undefined ? ` (travel ${R(d.km_rate)} per km)` : ''}${d.food_per_day !== undefined ? ` (food ${R(d.food_per_day)} per day)` : ''}`],
  lead_created: ['Sales', (d) => `added the school ${d.school || ''} to the pipeline`], lead_updated: ['Sales', (d, r) => `updated the school ${r.target}`], lead_activity: ['Sales', (d, r) => `logged a ${String(d.type || 'visit').toLowerCase()} at ${r.target}${d.met ? ` (met ${d.met})` : ''}`],
  lead_converted: ['Sales', (d) => `turned the lead ${d.school || ''} into a school`], lead_photo_added: ['Sales', (d, r) => `added a photo at ${r.target}`], lead_photo_deleted: ['Sales', (d, r) => `deleted a school photo (${r.target})`],
  lead_distance: ['Sales', (d, r) => `changed the km of a visit from ${d.from_km ?? '?'} to ${d.to_km ?? d.km} km (${r.target})`], trip_return: ['Sales', (d) => `logged the trip home on ${d.date}: ${d.to_km} km`], trip_return_deleted: ['Sales', (d) => `removed the trip home of ${d.date}`],
  invoice_created: ['Money', (d, r) => `raised invoice ${r.target} for ${d.school || ''}${d.total ? ` (${R(d.total)})` : ''}`], invoice_status_changed: ['Money', (d, r) => `marked invoice ${r.target} as ${d.to}`], payment_recorded: ['Money', (d, r) => `recorded ${R(d.amount)} received on invoice ${r.target}${d.closed ? ' (now fully paid)' : ''}`],
  credit_note_issued: ['Money', (d, r) => `issued credit note ${r.target} of ${R(d.amount)} on invoice ${d.invoice}`], refund_recorded: ['Money', (d, r) => `recorded a refund of ${R(d.amount)} on invoice ${r.target}`],
  promise_added: ['Money', (d) => `noted that ${d.school} promised to pay ${R(d.amount)} on ${d.on}`], promise_updated: ['Money', (d, r) => `updated a payment promise (${r.target})`], promise_followup: ['Money', (d) => `logged a follow-up call about the payment of ${d.school}`],
  ta_approved: ['Money', (d, r) => `approved travel and food allowance ${r.target.replace(':', ' for ')}: ${d.km} km, ${R(d.amount)}`], ta_paid: ['Money', (d, r) => `paid travel and food allowance ${r.target.replace(':', ' for ')}: ${R(d.amount)}${d.reference ? ` (${d.reference})` : ''}`],
  expense_added: ['Money', (d) => `added an expense of ${R(d.amount)} (${d.category}) for ${d.who}`], expense_deleted: ['Money', (d) => `deleted an expense of ${R(d.amount)} of ${d.who}`],
  claim_submitted: ['Sales', (d) => `submitted an expense claim of ${R(d.amount)} (${d.category})`], claim_withdrawn: ['Sales', () => 'withdrew an expense claim'], claim_decided: ['Money', (d) => `${String(d.decision).toLowerCase()} the ${R(d.amount)} expense claim of ${d.who}`],
  claim_paid: ['Money', (d) => `paid the ${R(d.amount)} expense claim of ${d.who}`], report_submitted: ['Money', (d) => `sent the ${d.month} report to the owner`], reminders_sent: ['Money', (d) => `emailed the payment follow-up list${d.sent ? '' : ' (not sent)'}`],
  employee_added: ['Salaries', (d) => `added the employee ${d.name} (salary ${R(d.salary)})`], employee_updated: ['Salaries', (d, r) => `changed an employee's details${d.monthly_salary !== undefined ? `, salary ${R(d.monthly_salary)}` : ''} (${r.target})`],
  payroll_prepared: ['Salaries', (d, r) => `prepared the salaries of ${r.target} (${d.lines} lines)`], salary_edited: ['Salaries', (d) => `adjusted the ${d.month} salary of ${d.who} (net ${R(d.net)})`], salary_approved: ['Salaries', (d) => `approved the ${d.month} salary of ${d.who} (${R(d.net)})`],
  salary_paid: ['Salaries', (d) => `paid ${R(d.amount)} of the ${d.month} salary of ${d.who} by ${d.mode}${d.reference ? ` (${d.reference})` : ''}`], salary_reopened: ['Salaries', (d) => `reopened the ${d.month} salary of ${d.who}`], salary_deleted: ['Salaries', (d) => `removed the ${d.month} salary line of ${d.who}`],
  company_expense_added: ['Salaries', (d) => `added a company expense: ${d.category}${d.vendor ? ` to ${d.vendor}` : ''}, ${R(d.amount)}`], company_expense_deleted: ['Salaries', (d) => `deleted a company expense of ${R(d.amount)} (${d.category})`],
  target_set: ['Sales', (d) => `set the ${d.month} targets of ${d.who}: ${d.visits} visits, ${R(d.won_value)} won`], invoice_emailed: ['Money', (d, r) => `emailed invoice ${r.target} to ${d.to}`],
  release_added: ['Support', (d) => `posted ${String(d.kind || 'release').toLowerCase()} ${d.version}`], release_deleted: ['Support', (d) => `deleted release notes ${d.version}`], digest_sent: ['Team', (d, r) => `sent the ${r.target} email now`],
  ticket_updated: ['Support', (d, r) => `updated support ticket ${r.target}`], ticket_note: ['Support', (d, r) => `replied on support ticket ${r.target}`],
};
const describe = (row) => {
  const d = row.detail && typeof row.detail === 'object' ? row.detail : {};
  const hit = LABELS[row.action];
  if (hit) { let text = ''; try { text = hit[1](d, row); } catch { text = row.action.replace(/_/g, ' '); } return { area: hit[0], text }; }
  return { area: 'Security', text: row.action.replace(/_/g, ' ') };
};
const dayHeading = (iso) => { const d = new Date(`${iso.slice(0, 10)}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); const diff = Math.round((today - d) / 86400000); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
const clock = (iso) => new Date(`${iso}Z`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export const AuditPage = () => {
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');
  const { data, loading, error, reload } = useFetch('/audit', { limit: 800 });
  const rows = (data || []).map((r) => ({ ...r, ...describe(r) }));
  const counts = rows.reduce((m, r) => ({ ...m, [r.area]: (m[r.area] || 0) + 1 }), {});
  const shown = rows.filter((r) => (!area || r.area === area) && (!q || `${r.actor_name} ${r.actor} ${r.text} ${r.target}`.toLowerCase().includes(q.toLowerCase())));
  const days = shown.reduce((m, r) => { const k = r.at.slice(0, 10); (m[k] = m[k] || []).push(r); return m; }, {});
  return (
    <>
      <PageHead title="Audit log" subtitle="A diary of everything that happens in the platform admin: who did what, and when." />
      <div className="mb-5 rounded-2xl border border-[#E2DDD1] bg-white p-5 text-[14px] leading-6 text-[#4A4F5C]">
        <p className="mb-1 flex items-center gap-2 font-semibold text-[#1F2433]"><ShieldCheck className="h-4 w-4 text-[#2E2A6E]" />What is this?</p>
        Every time someone signs in, changes a price, approves travel, pays a salary or edits a school, one line is written here automatically. <b>Nobody can edit or delete these lines</b>, not even you, so if money or a setting looks wrong later, you can see exactly who changed it and when. Failed sign-ins (someone guessing a password) show up here in red.
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setArea('')} aria-pressed={!area} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${!area ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}>Everything {rows.length}</button>
        {Object.keys(AREAS).map((a) => <button key={a} type="button" onClick={() => setArea(area === a ? '' : a)} aria-pressed={area === a} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${area === a ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}>{a} {counts[a] || 0}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a person or a word" aria-label="Search" className={`${selectCls} ml-auto w-60`} />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : shown.length === 0 ? <Card><Empty>Nothing recorded for this filter.</Empty></Card> : (
        <div className="space-y-6">
          {Object.entries(days).map(([day, list]) => (
            <section key={day} aria-label={dayHeading(day)}>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mb-2 text-[17px] font-medium text-[#1F2433]">{dayHeading(day)} <span className="text-[13px] font-normal text-[#8A8F9C]">· {list.length} {list.length === 1 ? 'entry' : 'entries'}</span></h2>
              <ul className="overflow-hidden rounded-2xl border border-[#E2DDD1] bg-white">
                {list.map((r) => { const meta = AREAS[r.area] || AREAS.Security; const Icon = meta.icon; const bad = /failed|blocked/.test(r.action); const name = r.actor_name || r.actor || 'Someone'; return (
                  <li key={r.id} className={`border-b border-[#F0ECE2] last:border-0 ${bad ? 'bg-red-50/60' : ''}`}>
                    <button type="button" onClick={() => setOpen(open === r.id ? '' : r.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#FAF8F3]" aria-expanded={open === r.id}>
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: bad ? '#FBE3E3' : meta.bg, color: bad ? '#B91C1C' : meta.color }}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1 text-[14px] leading-5 text-[#1F2433]"><b>{name}</b> {r.text}{r.actor_role ? <span className="ml-1.5 rounded-full bg-[#F4F1EA] px-2 py-0.5 text-[11px] capitalize text-[#6B7080]">{r.actor_role}</span> : null}</span>
                      <span className="shrink-0 text-[12.5px] text-[#8A8F9C]">{clock(r.at)}</span>
                    </button>
                    {open === r.id && <div className="border-t border-[#F0ECE2] bg-[#FAF8F3] px-4 py-3 pl-[60px] text-[12.5px] text-[#5B6070]"><p>{r.actor || '—'}{r.ip ? ` · from ${r.ip}` : ''} · {fmtDateTime(r.at)}</p><p className="mt-1 break-words font-mono text-[11.5px] text-[#6B7080]">{r.action}{r.target ? ` · ${r.target}` : ''}{r.detail && typeof r.detail === 'object' ? ` · ${JSON.stringify(r.detail)}` : r.detail ? ` · ${r.detail}` : ''}</p></div>}
                  </li>); })}
              </ul>
            </section>))}
        </div>)}
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
