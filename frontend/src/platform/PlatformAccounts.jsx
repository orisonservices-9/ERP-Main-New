import React, { useState } from 'react';
import { Check, Copy, KeyRound, Pencil, ShieldAlert } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askConfirm, notify } from '../components/AppFeedback';
import { Btn, Card, ErrorBox, Loading, Modal, Pill, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls, selectCls } from './ui';

const copy = async (text, label) => {
  try { await navigator.clipboard.writeText(text); notify(`${label} copied`, 'success'); } catch { notify('Could not copy. Select the text and copy it.', 'error'); }
};

const Reveal = ({ item, onClose }) => (
  <Modal title={`New password for ${item.role_label}`} onClose={onClose}>
    <div className="space-y-4">
      <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13.5px] leading-5 text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>This password is shown <b>only now</b>. We keep it scrambled, so nobody can read it again. Give it to the school, or set a new one later.</span></p>
      {[['Username', item.username], ['Password', item.password]].map(([label, value]) => (
        <div key={label}>
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">{label}</p>
          <div className="flex items-center gap-2"><code className="flex-1 select-all rounded-lg border border-[#E2DDD1] bg-[#FAF8F3] px-3.5 py-2.5 text-[16px] tracking-wide text-[#1F2433]" data-testid={`reveal-${label.toLowerCase()}`}>{value}</code>
            <Btn variant="ghost" onClick={() => copy(value, label)}><Copy className="h-4 w-4" />Copy</Btn></div>
        </div>
      ))}
      <div className="flex justify-end"><Btn onClick={onClose}>I have saved it</Btn></div>
    </div>
  </Modal>
);

const Accounts = ({ school }) => {
  const { data, loading, error, reload } = useFetch(`/schools/${school.id}/accounts`);
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  const [reveal, setReveal] = useState(null);
  const [busy, setBusy] = useState('');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const update = async (role, body, ok) => {
    try { await pApi.put(`/schools/${school.id}/accounts/${role}`, body); notify(ok, 'success'); setEditing(''); reload(); } catch (err) { notify(errText(err), 'error'); }
  };
  const setPassword = async (row) => {
    if (!(await askConfirm(`${row.password_set ? 'Replace the password' : 'Set a password'} for the ${row.role_label} login? You will see it once.`))) return;
    setBusy(row.role);
    try { const { data: made } = await pApi.post(`/schools/${school.id}/accounts/${row.role}/password`); setReveal(made); reload(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(''); }
  };

  return (
    <Card title="School logins" subtitle="The username and password each login at this school uses. Only the Owner can see this."
      action={<Pill tone="amber">Owner only</Pill>}>
      <p className="mb-4 flex gap-2 rounded-xl bg-[#FAF8F3] px-3.5 py-3 text-[13px] leading-5 text-[#5B6070]"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#3F3A8C]" />
        <span>Passwords are stored scrambled, so nobody (not even Orison) can read one afterwards. <b>Set a password</b> to make a new one: it is shown once for you to give to the school. You can set a new one any time.
          {!data.enforced && <> The school's own app starts checking these when the multi-school login is built (see DEVELOPER_ROADMAP.md); until then it still signs in by login type.</>}</span></p>
      <TableWrap>
        <THead cols={['Login', 'Username', 'Password', 'Last sign-in', 'Active', '']} />
        <tbody>
          {data.accounts.map((row) => (
            <tr key={row.role}>
              <Td className="whitespace-nowrap font-medium">{row.role_label}</Td>
              <Td className="min-w-[230px]">
                {editing === row.role ? (
                  <span className="flex items-center gap-1.5"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={`Username for ${row.role_label}`} className={`${selectCls} h-9 w-56`} />
                    <button type="button" aria-label="Save username" onClick={() => update(row.role, { username: name }, 'Username saved')} className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"><Check className="h-4 w-4" /></button></span>
                ) : (
                  <span className="flex items-center gap-1.5"><code className="rounded bg-[#F4F1EA] px-2 py-1 text-[13px]" data-testid={`username-${row.role}`}>{row.username}</code>
                    <button type="button" aria-label="Copy username" onClick={() => copy(row.username, 'Username')} className="rounded-md p-1.5 text-[#6B7080] hover:bg-[#F4F1EA]"><Copy className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Change username" onClick={() => { setEditing(row.role); setName(row.username); }} className="rounded-md p-1.5 text-[#6B7080] hover:bg-[#F4F1EA]"><Pencil className="h-3.5 w-3.5" /></button></span>
                )}
              </Td>
              <Td className="whitespace-nowrap">{row.password_set ? <><Pill tone="green">Set</Pill><div className="mt-0.5 text-[12px] text-[#6B7080]">{fmtDate(row.password_set_at)} by {row.password_set_by}</div></> : <Pill>Not set</Pill>}</Td>
              <Td className="whitespace-nowrap">{row.last_sign_in ? fmtDateTime(row.last_sign_in) : <span className="text-[#8A8F9C]">Never</span>}</Td>
              <Td><input type="checkbox" checked={row.active} aria-label={`${row.role_label} login active`} onChange={(e) => update(row.role, { active: e.target.checked }, e.target.checked ? 'Login switched on' : 'Login switched off')} /></Td>
              <Td className="text-right"><Btn variant="ghost" busy={busy === row.role} onClick={() => setPassword(row)}>{row.password_set ? 'Set a new password' : 'Set password'}</Btn></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {reveal && <Reveal item={reveal} onClose={() => setReveal(null)} />}
    </Card>
  );
};

const SchoolAccounts = ({ school }) => {
  const { can } = usePlatform();
  return can('credentials:manage') ? <Accounts school={school} /> : null;
};

export default SchoolAccounts;
