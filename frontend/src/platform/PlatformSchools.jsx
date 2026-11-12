import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Boxes, Briefcase, Check, ChevronDown, Crown, Eye, GraduationCap, Lock, Plus, Search, ShieldCheck, Wallet } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { notify } from '../components/AppFeedback';
import { InvoiceTable, BillingPanel } from './PlatformBilling';
import ActivityPanel from './PlatformActivity';
import SchoolAccounts from './PlatformAccounts';
import {
  Btn, Card, Empty, ErrorBox, Field, Loading, Meter, Modal, PageHead, Pill, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls,
  inr, num, planTone, serif, statusTone, selectCls } from './ui';

const PLAN_LABEL = { essential: 'Essential', pro: 'Pro', premium: 'Premium' };
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);

const AddSchoolModal = ({ onClose }) => {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', code: '', plan: 'essential', status: 'Trial', board: '', city: '', state: '', contact_name: '', contact_email: '', contact_phone: '', student_count: '', contract_start: '', contract_end: '' });
  const [codeTouched, setCodeTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value, ...(key === 'name' && !codeTouched ? { code: slug(e.target.value) } : {}) }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await pApi.post('/schools', { ...f, student_count: Number(f.student_count || 0) });
      notify('School created', 'success');
      navigate(`/platform/schools/${data.id}`);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add a school" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="School name"><input autoFocus value={f.name} onChange={set('name')} className={inputCls} /></Field>
        <Field label="School code" hint="Short and unique, like greenvalley. Used to identify the school."><input value={f.code} onChange={(e) => { setCodeTouched(true); set('code')(e); }} className={inputCls} /></Field>
        <Field label="Plan"><select value={f.plan} onChange={set('plan')} className={inputCls}>{Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Status"><select value={f.status} onChange={set('status')} className={inputCls}>{['Trial', 'Active'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Board"><input value={f.board} onChange={set('board')} placeholder="CBSE, ICSE, State…" className={inputCls} /></Field>
        <Field label="Students (approx.)"><input type="number" min="0" value={f.student_count} onChange={set('student_count')} className={inputCls} /></Field>
        <Field label="City"><input value={f.city} onChange={set('city')} className={inputCls} /></Field>
        <Field label="State"><input value={f.state} onChange={set('state')} className={inputCls} /></Field>
        <Field label="Contact person"><input value={f.contact_name} onChange={set('contact_name')} className={inputCls} /></Field>
        <Field label="Contact phone"><input value={f.contact_phone} onChange={set('contact_phone')} className={inputCls} /></Field>
        <Field label="Contact email"><input type="email" value={f.contact_email} onChange={set('contact_email')} className={inputCls} /></Field>
        <span />
        <Field label="Contract starts"><input type="date" value={f.contract_start} onChange={set('contract_start')} className={inputCls} /></Field>
        <Field label="Contract ends"><input type="date" value={f.contract_end} onChange={set('contract_end')} className={inputCls} /></Field>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Create school</Btn></div>
      </form>
    </Modal>
  );
};

export const SchoolsList = () => {
  const { can } = usePlatform();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t); }, [q]);
  const { data, loading, error, reload } = useFetch('/schools', { q: query, status, plan });
  return (
    <>
      <PageHead title="Schools" subtitle="Every school on the platform, with its plan and contract."
        actions={can('schools:create') && <Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add school</Btn>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, city or contact" className={`${inputCls} pl-9`} /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectCls} w-40`} aria-label="Status"><option value="">All statuses</option>{['Trial', 'Active', 'Suspended', 'Expired'].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={`${selectCls} w-40`} aria-label="Plan"><option value="">All plans</option>{Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? (
        <Card><Empty>{query || status || plan ? 'No school matches these filters.' : 'No schools yet. Add the first one.'}</Empty></Card>
      ) : (
        <TableWrap>
          <THead cols={['School', 'Plan', 'Status', 'Students', 'WhatsApp this month', 'Contract ends']} />
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="hover:bg-[#FAF8F3]">
                <Td><Link to={`/platform/schools/${s.id}`} className="font-semibold text-[#2E2A6E] hover:underline">{s.name}</Link><div className="text-[12.5px] text-[#6B7080]">{s.code}{s.city ? ` · ${s.city}` : ''}</div></Td>
                <Td><Pill tone={planTone[s.plan]}>{PLAN_LABEL[s.plan]}</Pill></Td>
                <Td><Pill tone={statusTone[s.status]}>{s.status}</Pill></Td>
                <Td>{num(s.student_count)}</Td>
                <Td className="w-48"><div className="flex items-center gap-2"><Meter percent={s.whatsapp_percent} level={s.whatsapp_percent >= 100 ? 'over' : s.whatsapp_percent >= 80 ? 'warn' : 'ok'} /><span className="w-10 text-right text-[12.5px] text-[#5B6070]">{Math.round(s.whatsapp_percent)}%</span></div></Td>
                <Td>{fmtDate(s.contract_end)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {adding && <AddSchoolModal onClose={() => setAdding(false)} />}
    </>
  );
};

const TABS = [['overview', 'Overview'], ['plan', 'Plan & features'], ['access', 'Logins & access'], ['billing', 'Billing'], ['status', 'Status & history']];

const OverviewTab = ({ school, onSaved }) => {
  const { can } = usePlatform();
  const editable = can('schools:write');
  const fields = ['name', 'board', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'student_count', 'branch_count', 'student_limit', 'branch_limit', 'contract_start', 'contract_end', 'discount_percent', 'whatsapp_sender', 'whatsapp_used_month', 'notes'];
  const init = useMemo(() => Object.fromEntries(fields.map((k) => [k, school[k] ?? ''])), [school]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(init);
  const [waived, setWaived] = useState(!!school.setup_fee_waived);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(init); setWaived(!!school.setup_fee_waived); }, [init, school.setup_fee_waived]);
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));
  const numeric = new Set(['student_count', 'branch_count', 'student_limit', 'branch_limit', 'discount_percent', 'whatsapp_used_month']);
  const save = async (e) => {
    e.preventDefault();
    const body = {};
    fields.forEach((k) => {
      if (String(f[k]) === String(init[k])) return;
      if (numeric.has(k)) { if (f[k] !== '') body[k] = Number(f[k]); } else body[k] = f[k];
    });
    if (waived !== !!school.setup_fee_waived) body.setup_fee_waived = waived;
    if (!Object.keys(body).length) return notify('Nothing has changed.');
    setBusy(true);
    try { await pApi.put(`/schools/${school.id}`, body); notify('School details saved', 'success'); onSaved(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const T = ({ k, label, type = 'text', hint, span }) => (
    <div className={span ? 'sm:col-span-2' : ''}><Field label={label} hint={hint}><input type={type} min={type === 'number' ? 0 : undefined} disabled={!editable} value={f[k]} onChange={set(k)} className={inputCls} /></Field></div>
  );
  return (
    <form onSubmit={save} className="grid gap-5 lg:grid-cols-2">
      <Card title="School and contact"><div className="grid gap-4 sm:grid-cols-2">
        <T k="name" label="School name" span /><T k="board" label="Board" /><T k="city" label="City" /><T k="state" label="State" /><T k="address" label="Address" />
        <T k="contact_name" label="Contact person" /><T k="contact_phone" label="Contact phone" /><T k="contact_email" label="Contact email" type="email" />
      </div></Card>
      <Card title="Contract, limits and usage"><div className="grid gap-4 sm:grid-cols-2">
        <T k="contract_start" label="Contract starts" type="date" /><T k="contract_end" label="Contract ends" type="date" />
        <T k="student_count" label="Enrolled students" type="number" hint="Used for billing and the WhatsApp limit." /><T k="branch_count" label="Branches" type="number" />
        <T k="student_limit" label="Student limit" type="number" hint="Leave empty for no limit." /><T k="branch_limit" label="Branch limit" type="number" />
        <T k="discount_percent" label="Discount %" type="number" hint="Applied to the yearly subscription." />
        <Field label="One-time setup fee"><label className="flex h-10 items-center gap-2 text-[14px]"><input type="checkbox" disabled={!editable} checked={waived} onChange={(e) => setWaived(e.target.checked)} />Waived for this school</label></Field>
        <T k="whatsapp_sender" label="WhatsApp sender number" /><T k="whatsapp_used_month" label="WhatsApp used this month" type="number" hint="Entered by hand until sending is connected." />
      </div></Card>
      <Card title="Internal notes" className="lg:col-span-2"><textarea disabled={!editable} value={f.notes} onChange={set('notes')} rows={3} className={`${inputCls} h-auto py-2`} placeholder="Agreement details, special terms, who to call…" /></Card>
      {editable && <div className="lg:col-span-2"><Btn type="submit" busy={busy}>Save changes</Btn></div>}
    </form>
  );
};

const TIER_STYLE = {
  essential: { ring: 'border-[#2E2A6E]', dot: 'bg-[#9A9588]' },
  pro: { ring: 'border-[#2E2A6E]', dot: 'bg-[#6E69C9]' },
  premium: { ring: 'border-[#2E2A6E]', dot: 'bg-emerald-500' },
};

const PlanTab = ({ school, onSaved }) => {
  const { can } = usePlatform();
  const editable = can('schools:plan');
  const { data: catalog, loading, error } = useFetch('/catalog');
  const { data: pricing } = useFetch('/plans');
  const [plan, setPlan] = useState(school.plan);
  const [planReason, setPlanReason] = useState('');
  const [checked, setChecked] = useState(() => new Set(school.features));
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { setChecked(new Set(school.features)); setPlan(school.plan); }, [school.features, school.plan]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const rank = (p) => catalog.plans.indexOf(p);
  const base = new Set(catalog.features.filter((x) => rank(x.min_plan) <= rank(school.plan)).map((x) => x.key));
  const saved = new Set(school.features);
  const dirty = catalog.features.some((x) => checked.has(x.key) !== saved.has(x.key));
  const custom = catalog.features.filter((x) => checked.has(x.key) !== base.has(x.key)).length;
  const priceOf = (tier) => pricing?.plans.find((p) => p.id === tier);
  const q = query.trim().toLowerCase();

  const changePlan = async () => {
    setBusy('plan');
    try { await pApi.post(`/schools/${school.id}/plan`, { plan, reason: planReason }); notify('Plan changed. Features switched immediately.', 'success'); setPlanReason(''); onSaved(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(''); }
  };
  const saveFeatures = async () => {
    setBusy('features');
    try {
      const overrides = Object.fromEntries(catalog.features.map((x) => [x.key, checked.has(x.key)]));
      await pApi.put(`/schools/${school.id}/features`, { overrides, reason }); notify('Features saved', 'success'); setReason(''); onSaved();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(''); }
  };
  const toggle = (key) => setChecked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <div className="space-y-5">
      <Card title="Plan" subtitle="The plan decides the standard logins and features. Changing it switches features on or off straight away, and no data is deleted.">
        <div className="grid gap-4 md:grid-cols-3">
          {catalog.plans.map((tier) => {
            const p = priceOf(tier);
            const current = school.plan === tier;
            const selected = plan === tier;
            return (
              <button key={tier} type="button" disabled={!editable} onClick={() => setPlan(tier)} aria-pressed={selected}
                className={`relative rounded-xl border-2 p-4 text-left transition disabled:cursor-default ${selected ? 'border-[#2E2A6E] bg-[#F6F4FC]' : 'border-[#E2DDD1] bg-white hover:border-[#B9B4D8]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[16px] font-semibold text-[#1F2433]"><span className={`h-2.5 w-2.5 rounded-full ${TIER_STYLE[tier].dot}`} />{catalog.plan_labels[tier]}</span>
                  {current ? <Pill tone="green">Current plan</Pill> : selected ? <Pill tone="indigo">Selected</Pill> : null}
                </div>
                <p style={serif} className="mt-3 text-[26px] font-medium leading-none text-[#2E2A6E]">{p ? inr(p.rate_per_student) : '—'}<span className="ml-1 whitespace-nowrap font-sans text-[12.5px] text-[#6B7080]">/ student / yr</span></p>
                <p className="mt-3 text-[13px] text-[#5B6070]">{p ? `${p.features.length} features · ${p.logins.length} logins` : ''}</p>
              </button>
            );
          })}
        </div>
        {editable && plan !== school.plan && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="basis-full text-[14px] text-amber-900">Change <b>{school.name}</b> from <b>{catalog.plan_labels[school.plan]}</b> to <b>{catalog.plan_labels[plan]}</b>? The school's features and logins change right away.</p>
            <div className="min-w-[240px] max-w-md flex-1"><Field label="Reason (kept in the audit log)"><input value={planReason} onChange={(e) => setPlanReason(e.target.value)} placeholder="e.g. School upgraded at renewal" className={inputCls} /></Field></div>
            <Btn onClick={changePlan} busy={busy === 'plan'}>Change plan</Btn>
            <Btn variant="ghost" onClick={() => setPlan(school.plan)}>Cancel</Btn>
          </div>
        )}
      </Card>

      <Card title="Features for this school" subtitle={custom ? `${custom} ${custom === 1 ? 'feature differs' : 'features differ'} from the standard ${catalog.plan_labels[school.plan]} plan (special agreement).` : `Standard ${catalog.plan_labels[school.plan]} plan. Click a feature to switch it on or off for this school only.`}
        action={editable && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && <Pill tone="amber">Unsaved changes</Pill>}
            <Btn variant="ghost" onClick={() => setChecked(new Set(base))} disabled={!custom && !dirty}>Reset to plan</Btn>
            <Btn onClick={saveFeatures} busy={busy === 'features'} disabled={!dirty}>Save features</Btn>
          </div>
        )}>
        <div className="relative mb-5 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search features" className={`${inputCls} pl-9`} /></div>
        {catalog.plans.map((tier) => {
          const items = catalog.features.filter((x) => x.min_plan === tier);
          const shown = items.filter((x) => !q || x.label.toLowerCase().includes(q));
          if (!shown.length) return null;
          const on = items.filter((x) => checked.has(x.key)).length;
          return (
            <section key={tier} className="mb-6 last:mb-0">
              <div className="mb-3 flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${TIER_STYLE[tier].dot}`} />
                <h3 className="text-[14px] font-semibold text-[#1F2433]">{catalog.plan_labels[tier]} features</h3>
                <span className="text-[12.5px] text-[#6B7080]">{on} of {items.length} on</span>
                <span className="h-px flex-1 bg-[#EEEAE0]" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((x) => {
                  const isOn = checked.has(x.key);
                  const diff = isOn !== base.has(x.key);
                  return (
                    <button key={x.key} type="button" disabled={!editable} onClick={() => toggle(x.key)} aria-pressed={isOn}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition disabled:cursor-default ${diff ? 'border-amber-400 bg-amber-50' : isOn ? 'border-[#D9D3F0] bg-[#F6F4FC]' : 'border-[#E2DDD1] bg-white hover:bg-[#FAF8F3]'}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isOn ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#CFCABD] bg-white text-transparent'}`}><Check className="h-3.5 w-3.5" /></span>
                      <span className={`flex-1 ${isOn ? 'text-[#1F2433]' : 'text-[#7A7F8C]'}`}>{x.label}</span>
                      {!x.built && <span title="Not built yet. Turning it on has no effect until the feature is released." className="text-[#B45309]">★</span>}
                      {diff && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{isOn ? 'Extra' : 'Removed'}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {q && !catalog.features.some((x) => x.label.toLowerCase().includes(q)) && <Empty>No feature matches "{query}".</Empty>}
        {editable && (
          <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-[#EEEAE0] pt-5">
            <div className="min-w-[260px] max-w-md flex-1"><Field label="Reason for the change (kept in the audit log)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hostel promised in the agreement" className={inputCls} /></Field></div>
            <Btn onClick={saveFeatures} busy={busy === 'features'} disabled={!dirty}>Save features</Btn>
          </div>
        )}
        <p className="mt-4 text-[12.5px] text-[#6B7080]">★ = not built yet. Turning it on has no effect until the feature is released. Orange = different from the standard plan.</p>
      </Card>
    </div>
  );
};

const ROLE_INFO = {
  admin: { label: 'Admin', note: 'Runs the school office and settings', icon: ShieldCheck },
  teacher: { label: 'Class Teacher', note: 'Class register, marks and homework', icon: GraduationCap },
  fee_manager: { label: 'Fee Manager', note: 'Fee collection, receipts and payroll', icon: Wallet },
  director: { label: 'Director', note: 'Approvals, reports and branches', icon: Crown },
  academic_coordinator: { label: 'Academic Coordinator', note: 'Exams, syllabus and student support', icon: Briefcase },
  stock_manager: { label: 'Stock Manager', note: 'Purchases, uniforms and stock', icon: Boxes },
  librarian: { label: 'Librarian', note: 'Books, loans and fines', icon: BookOpen },
};

const Switch = ({ on, onChange, disabled, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
    className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-[#2E2A6E]' : 'bg-[#CFCABD]'}`}>
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
);

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Which logins this school gets, and what each login can open. Every login starts with what its role should
// have (the "standard"); only the changes made for this school are saved.
const AccessCard = ({ school, onSaved }) => {
  const { can } = usePlatform();
  const editable = can('schools:plan');
  const { data: catalog } = useFetch('/catalog');
  const fromSchool = () => Object.fromEntries(school.plan_logins.map((r) => [r, new Set(school.logins.includes(r) ? school.role_features[r] : school.role_defaults[r])]));
  const [logins, setLogins] = useState(() => new Set(school.logins));
  const [allowed, setAllowed] = useState(fromSchool);
  const [openKey, setOpenKey] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLogins(new Set(school.logins)); setAllowed(fromSchool()); }, [school]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!catalog) return null;

  const planSet = new Set(school.features);
  const meta = Object.fromEntries(catalog.features.map((f) => [f.key, f]));
  const standard = (role) => new Set(school.role_defaults[role]);
  const changedFromStandard = (role) => !sameSet(allowed[role], standard(role));
  const changedRoles = school.plan_logins.filter((r) => logins.has(r) && changedFromStandard(r)).length;
  const dirty = !sameSet(logins, new Set(school.logins)) || school.logins.some((r) => !sameSet(allowed[r], new Set(school.role_features[r])));

  const toggleLogin = (role) => setLogins((s) => { const n = new Set(s); if (n.has(role)) n.delete(role); else n.add(role); return n; });
  const toggleFeature = (role, key) => setAllowed((a) => { const n = new Set(a[role]); if (n.has(key)) n.delete(key); else n.add(key); return { ...a, [role]: n }; });
  const restoreRole = (role) => setAllowed((a) => ({ ...a, [role]: standard(role) }));
  const resetAll = () => { setLogins(new Set(school.plan_logins)); setAllowed(Object.fromEntries(school.plan_logins.map((r) => [r, standard(r)]))); };
  const feesAwayFromAdmin = () => {
    const money = (catalog.areas.find((a) => a.key === 'fees_money') || { features: [] }).features;
    setLogins((s) => new Set([...s, 'admin', 'fee_manager']));
    setAllowed((a) => ({ ...a, admin: new Set([...a.admin].filter((k) => !money.includes(k))) }));
  };
  const save = async () => {
    setBusy(true);
    try {
      const access = Object.fromEntries([...logins].map((r) => [r, [...allowed[r]]]));
      await pApi.put(`/schools/${school.id}/access`, { logins: [...logins], access, reason });
      notify('Logins and access saved', 'success'); setReason(''); onSaved();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <Card title="Logins and access" subtitle="Each login starts with what its role should have. Switch logins on or off for this school, and open a login to add or remove individual features if the school asks."
      action={editable && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && <Pill tone="amber">Unsaved changes</Pill>}
          <Btn variant="ghost" onClick={resetAll}>Reset to standard</Btn>
          <Btn onClick={save} busy={busy} disabled={!dirty}>Save access</Btn>
        </div>
      )}>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-[#FAF8F3] px-4 py-3">
        <p className="text-[14px] text-[#2B3040]"><b>{logins.size}</b> of {school.plan_logins.length} logins on</p>
        <p className="text-[14px] text-[#2B3040]"><b>{changedRoles}</b> {changedRoles === 1 ? 'login' : 'logins'} changed from standard</p>
        {editable && (
          <button type="button" onClick={feesAwayFromAdmin} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 text-[13px] font-medium text-[#2E2A6E] hover:bg-[#EEEAF8]">
            <Lock className="h-3.5 w-3.5" />Keep fees away from Admin
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {school.plan_logins.map((role) => {
          const info = ROLE_INFO[role] || { label: role, note: '', icon: ShieldCheck };
          const Icon = info.icon;
          const on = logins.has(role);
          const mine = allowed[role];
          const std = standard(role);
          const changed = on && changedFromStandard(role);
          return (
            <div key={role} className={`rounded-xl border p-4 transition ${on ? 'border-[#D9D3C6] bg-white' : 'border-dashed border-[#DAD6CC] bg-[#FAF8F3]'}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-[#EEEAF8] text-[#3F3A8C]' : 'bg-[#EEEAE0] text-[#9A9588]'}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] font-semibold ${on ? 'text-[#1F2433]' : 'text-[#7A7F8C]'}`}>{info.label}</p>
                  <p className="text-[12.5px] leading-5 text-[#6B7080]">{info.note}</p>
                </div>
                <Switch on={on} disabled={!editable} onChange={() => toggleLogin(role)} label={`${info.label} login for this school`} />
              </div>

              {on ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-[#5B6070]">{mine.size === planSet.size ? 'Everything in the plan' : `${mine.size} of ${planSet.size} plan features`}</span>
                    {changed
                      ? <span className="flex items-center gap-2"><Pill tone="amber">Changed</Pill>{editable && <button type="button" onClick={() => restoreRole(role)} className="font-medium text-[#3F3A8C] hover:underline">Restore standard</button>}</span>
                      : <Pill tone="gray">Standard</Pill>}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {catalog.areas.map((area) => {
                      const feats = area.features.filter((k) => planSet.has(k));
                      if (!feats.length) return null;
                      const have = feats.filter((k) => mine.has(k)).length;
                      const key = `${role}:${area.key}`;
                      const open = openKey === key;
                      const stateTone = have === feats.length ? 'bg-emerald-50 text-emerald-800' : have === 0 ? 'bg-[#EEEAE0] text-[#6B7080]' : 'bg-indigo-50 text-indigo-800';
                      return (
                        <li key={area.key} className="rounded-lg border border-[#EEEAE0]">
                          <button type="button" onClick={() => setOpenKey(open ? '' : key)} aria-expanded={open}
                            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] hover:bg-[#FAF8F3]">
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#8A8F9C] transition ${open ? '' : '-rotate-90'}`} />
                            <span className="flex-1 text-[#2B3040]">{area.label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${stateTone}`}>{have === feats.length ? 'All' : have === 0 ? 'None' : `${have} of ${feats.length}`}</span>
                          </button>
                          {open && (
                            <div className="space-y-1.5 border-t border-[#EEEAE0] p-2.5">
                              {feats.map((k) => {
                                const isOn = mine.has(k);
                                const diff = isOn !== std.has(k);
                                return (
                                  <button key={k} type="button" disabled={!editable} onClick={() => toggleFeature(role, k)} aria-pressed={isOn}
                                    className={`flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] transition disabled:cursor-default ${diff ? 'border-amber-400 bg-amber-50' : isOn ? 'border-[#D9D3F0] bg-[#F6F4FC]' : 'border-[#E2DDD1] bg-white hover:bg-[#FAF8F3]'}`}>
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isOn ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#CFCABD] bg-white text-transparent'}`}><Check className="h-3 w-3" /></span>
                                    <span className={`flex-1 ${isOn ? 'text-[#1F2433]' : 'text-[#7A7F8C]'}`}>{meta[k]?.label || k}</span>
                                    {diff && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800">{isOn ? 'Extra' : 'Removed'}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="mt-4 rounded-lg bg-[#EEEAE0] px-3 py-2.5 text-[12.5px] text-[#6B7080]">This login is off. The school will not get it.</p>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] max-w-md flex-1"><Field label="Reason (kept in the audit log)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. School asked for fees to be separate from Admin" className={inputCls} /></Field></div>
          <Btn onClick={save} busy={busy} disabled={!dirty}>Save access</Btn>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-[#6B7080]">Orange means different from the standard for that role. At least one login must keep every feature in the plan.</p>
    </Card>
  );
};

const StatusTab = ({ school, onSaved }) => {
  const { can } = usePlatform();
  const [status, setStatus] = useState(school.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await pApi.post(`/schools/${school.id}/status`, { status, reason }); notify('Status updated', 'success'); setReason(''); onSaved(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Status" subtitle="Trial and Active schools can use the app. Suspended and Expired schools should be blocked.">
        <Field label="Status"><select disabled={!can('schools:status')} value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>{['Trial', 'Active', 'Suspended', 'Expired'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="mt-4"><Field label="Reason" hint="Required when suspending."><input disabled={!can('schools:status')} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} /></Field></div>
        {can('schools:status') && <div className="mt-4"><Btn onClick={save} busy={busy} disabled={status === school.status}>Update status</Btn></div>}
        <p className="mt-4 rounded-lg bg-[#FAF8F3] px-3 py-2 text-[12.5px] text-[#5B6070]">The status is recorded here. Blocking a suspended school's staff from signing in is switched on when the multi-school login is built (see DEVELOPER_ROADMAP.md, Phase 0).</p>
      </Card>
      <Card title="History">
        <ul className="space-y-3 text-[13.5px]">
          {[...(school.status_history || []).map((h) => ({ at: h.at, text: `Status: ${h.status}`, by: h.by, reason: h.reason })),
            ...(school.plan_history || []).map((h) => ({ at: h.at, text: `Plan: ${PLAN_LABEL[h.from]} → ${PLAN_LABEL[h.to]}`, by: h.by, reason: h.reason }))]
            .sort((a, b) => (a.at < b.at ? 1 : -1)).map((h, i) => (
              <li key={i} className="border-b border-[#F0ECE2] pb-2 last:border-0"><span className="font-medium">{h.text}</span><div className="text-[12.5px] text-[#6B7080]">{fmtDateTime(h.at)} · {h.by}{h.reason ? ` · ${h.reason}` : ''}</div></li>
            ))}
        </ul>
      </Card>
    </div>
  );
};

export const SchoolDetail = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(`/schools/${id}`);
  const { can } = usePlatform();
  const [tab, setTab] = useState('overview');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const tabs = TABS.filter(([key]) => key !== 'billing' || can('billing:read'));
  return (
    <>
      <p className="mb-2 text-[13px]"><Link to="/platform/schools" className="text-[#3F3A8C] hover:underline">← All schools</Link></p>
      <PageHead title={data.name} subtitle={`${data.code}${data.city ? ` · ${data.city}` : ''}${data.board ? ` · ${data.board}` : ''}`}
        actions={<><Pill tone={planTone[data.plan]}>{PLAN_LABEL[data.plan]}</Pill><Pill tone={statusTone[data.status]}>{data.status}</Pill>
          <Btn variant="ghost" disabled title="Opens the school's own app as its Admin, with every session logged. Available once the multi-school login is built."><Eye className="h-4 w-4" />View as school</Btn></>} />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#E2DDD1]">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-medium ${tab === key ? 'border-[#2E2A6E] text-[#2E2A6E]' : 'border-transparent text-[#5B6070] hover:text-[#1F2433]'}`}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && (<div className="space-y-5"><OverviewTab school={data} onSaved={reload} /><SchoolAccounts school={data} /></div>)}
      {tab === 'plan' && <PlanTab school={data} onSaved={reload} />}
      {tab === 'access' && <AccessCard school={data} onSaved={reload} />}
      {tab === 'billing' && (
        <div className="space-y-5">
          <BillingPanel school={data} onChanged={reload} />
          <Card title="Invoices for this school">{data.invoices.length ? <InvoiceTable invoices={data.invoices} onChanged={reload} embedded /> : <Empty>No invoice yet.</Empty>}</Card>
        </div>
      )}
      {tab === 'status' && (<div className="space-y-10"><StatusTab school={data} onSaved={reload} /><ActivityPanel school={data} /></div>)}
    </>
  );
};
