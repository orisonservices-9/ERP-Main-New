import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, BellRing, Building2, CalendarClock, Check, CircleDollarSign, ClipboardList, LayoutGrid, List, Mail, MapPin, MessageCircle, MessageSquare, Phone, PhoneCall,
  Plus, Presentation, Route as RouteIcon, Search, Trash2, Trophy, Users, Camera,
} from 'lucide-react';
import { LocationCard, PhotosCard, RoutesView } from './PlatformRoutes';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askText, notify } from '../components/AppFeedback';
import { Btn, Empty, ErrorBox, Field, Loading, Modal, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls, inr, num, selectCls, serif } from './ui';

// ---------------------------------------------------------------- shared bits
const STAGE_STYLE = {
  'New lead': { c: '#6B7080', bg: '#EEEAE0' }, Visited: { c: '#3157C8', bg: '#E6EDFC' }, 'Demo done': { c: '#6D3FA8', bg: '#EFE8FA' },
  'Proposal sent': { c: '#B45309', bg: '#FCEFD9' }, Negotiation: { c: '#C2410C', bg: '#FDE9DA' }, Won: { c: '#047857', bg: '#DAF3E8' }, Lost: { c: '#B91C1C', bg: '#FBE3E3' },
};
const OPEN = ['New lead', 'Visited', 'Demo done', 'Proposal sent', 'Negotiation'];
const TEMP_COLOR = { Hot: '#DC2626', Warm: '#F59E0B', Cold: '#3B82F6' };
const PLAN_LABEL = { essential: 'Essential', pro: 'Pro', premium: 'Premium' };
const ERP = Object.keys(PLAN_LABEL);
const PRODUCT_LABEL = { essential: 'ERP Essential', pro: 'ERP Pro', premium: 'ERP Premium', robotics: 'Robotics', vr: 'VR', ifb: 'IFB', kreedo: 'Kreedo', custom: 'Custom' };
const PRODUCT_COLOR = { essential: '#6B7080', pro: '#3F3A8C', premium: '#047857', robotics: '#C2410C', vr: '#6D3FA8', ifb: '#0E7490', kreedo: '#BE185D', custom: '#4B5563' };
const ACTIVITY_ICON = { Visit: Building2, Meeting: Users, Demo: Presentation, Call: PhoneCall, WhatsApp: MessageCircle, Email: Mail, Other: MessageSquare };
const PAGE = 25;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const digits = (v) => String(v || '').replace(/\D/g, '');
const tel = (v) => `tel:${digits(v)}`;
const wa = (v) => { const d = digits(v); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const short = (n) => { const v = Number(n || 0); if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, '')} Cr`; if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')} L`; if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`; return `₹${v}`; };
const dayDiff = (a, b) => Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);
const when = (date, today) => {
  if (!date) return 'No date';
  const d = dayDiff(date, today);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d < 0 ? `${-d} days overdue` : `In ${d} days`;
};

const StagePill = ({ stage }) => <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: STAGE_STYLE[stage].bg, color: STAGE_STYLE[stage].c }}>{stage}</span>;
const TempDot = ({ temp }) => <span title={`${temp} lead`} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#5B6070]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TEMP_COLOR[temp] }} />{temp}</span>;
const Avatar = ({ name, size = 28 }) => <span title={name} className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#2E2A6E] font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
const Chips = ({ products, max = 3 }) => (
  <span className="flex flex-wrap items-center gap-1">
    {products.slice(0, max).map((p, i) => <span key={`${p.product}${i}`} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: `${PRODUCT_COLOR[p.product] || '#6B7080'}14`, color: PRODUCT_COLOR[p.product] || '#6B7080' }}>{p.label || PRODUCT_LABEL[p.product]}</span>)}
    {products.length > max && <span className="text-[11.5px] text-[#6B7080]">+{products.length - max}</span>}
    {products.length === 0 && <span className="text-[12px] text-[#8A8F9C]">Nothing pitched yet</span>}
  </span>
);
const FollowChip = ({ row, today }) => {
  if (row.stage === 'Won' || row.stage === 'Lost') return null;
  if (!row.next_follow_up) return <span className="rounded-full bg-[#F4F1EA] px-2 py-0.5 text-[11.5px] text-[#8A8F9C]">No follow-up date</span>;
  const tone = row.follow_up_overdue ? ['#FBE3E3', '#B91C1C'] : row.follow_up_today ? ['#FCEFD9', '#B45309'] : ['#F4F1EA', '#4A4F5C'];
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: tone[0], color: tone[1] }}><CalendarClock className="h-3 w-3" />{when(row.next_follow_up, today)}</span>;
};

// ---------------------------------------------------------------- price list editor (several products, each with its own price)
const blankLine = () => ({ product: 'pro', quantity: '', rate: '', discount_percent: '', note: '' });
const lineTotal = (l) => Math.round(Number(l.quantity || 0) * Number(l.rate || 0) * (1 - Number(l.discount_percent || 0) / 100) * 100) / 100;
const ProductOptions = () => (
  <>
    <optgroup label="Orison ERP">{ERP.map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}</optgroup>
    <optgroup label="Other products">{['robotics', 'vr', 'ifb', 'kreedo', 'custom'].map((k) => <option key={k} value={k}>{PRODUCT_LABEL[k]}</option>)}</optgroup>
  </>
);
const toApi = (lines) => lines.map((l) => ({ product: l.product, quantity: Number(l.quantity || 0), rate: Number(l.rate || 0), discount_percent: Number(l.discount_percent || 0), note: l.note || '' }));
const fromApi = (lines) => lines.map((l) => ({ product: l.product, quantity: String(l.quantity || ''), rate: String(l.rate || ''), discount_percent: String(l.discount_percent || ''), note: l.note || '' }));

const PriceList = ({ lines, setLines, listRate, gst }) => {
  const set = (i, patch) => setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pick = (i, product) => setLines((all) => all.map((l, j) => {
    if (j !== i) return l;
    const wasList = ERP.includes(l.product) && Number(l.rate) === listRate(l.product);
    const rate = !l.rate || wasList ? (ERP.includes(product) ? String(listRate(product) || '') : '') : l.rate;
    return { ...l, product, rate };
  }));
  const total = Math.round(lines.reduce((a, l) => a + lineTotal(l), 0) * 100) / 100;
  return (
    <div>
      {lines.length === 0 && <p className="rounded-xl border border-dashed border-[#D8D3C6] px-4 py-5 text-center text-[13.5px] text-[#6B7080]">What did you pitch? Add each product with the price you quoted.</p>}
      <div className="space-y-3">
        {lines.map((l, i) => {
          const erp = ERP.includes(l.product);
          const list = erp ? listRate(l.product) : 0;
          const net = Number(l.rate || 0) * (1 - Number(l.discount_percent || 0) / 100);
          const below = list && net ? Math.round((1 - net / list) * 1000) / 10 : 0;
          return (
            <div key={i} className="rounded-xl border border-[#E2DDD1] bg-white p-3.5">
              <div className="flex items-center gap-2">
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: PRODUCT_COLOR[l.product] }} />
                <select aria-label="Product" value={l.product} onChange={(e) => pick(i, e.target.value)} className={`${selectCls} h-9 flex-1 font-semibold`}><ProductOptions /></select>
                <button type="button" aria-label="Remove product" onClick={() => setLines((all) => all.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-[#B91C1C] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <label className="block text-[12px] font-medium text-[#5B6070]">{erp ? 'Students' : 'Quantity'}<input type="number" min="0" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} className={`${inputCls} mt-1 h-9`} /></label>
                <label className="block text-[12px] font-medium text-[#5B6070]">{erp ? '₹ / student / year' : '₹ price each'}<input type="number" min="0" value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} className={`${inputCls} mt-1 h-9`} /></label>
                <label className="block text-[12px] font-medium text-[#5B6070]">Discount %<input type="number" min="0" max="100" value={l.discount_percent} onChange={(e) => set(i, { discount_percent: e.target.value })} className={`${inputCls} mt-1 h-9`} /></label>
              </div>
              <input aria-label="Note" value={l.note} onChange={(e) => set(i, { note: e.target.value })} placeholder={erp ? 'Note (optional)' : 'What exactly? e.g. Robotics lab for classes 6 to 8'} className={`${inputCls} mt-2.5 h-9`} />
              <div className="mt-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[#6B7080]">{erp && list ? `List price ₹${list}${net && below !== 0 ? ` · ${below > 0 ? `${below}% below` : `${-below}% above`} list` : ''}` : ''}</span>
                <b className="text-[14px] text-[#1F2433]">{inr(lineTotal(l))}</b>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => setLines((all) => [...all, blankLine()])} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#BDB8AC] px-3.5 py-2 text-[13.5px] font-medium text-[#3F3A8C] hover:bg-[#F6F4FC]"><Plus className="h-4 w-4" />Add a product</button>
      {lines.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#2E2A6E] px-4 py-3.5 text-white">
          <div className="flex items-baseline justify-between"><span className="text-[13px] text-white/70">Total quoted, before GST</span><b style={serif} className="text-[24px] font-medium">{inr(total)}</b></div>
          <div className="mt-1 flex justify-between text-[12.5px] text-white/65"><span>With GST {gst}%</span><span>{inr(Math.round(total * (1 + gst / 100) * 100) / 100)}</span></div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- add a school
const AddLeadModal = ({ options, salespeople, ownerView, onClose }) => {
  const navigate = useNavigate();
  const { data: pricing } = useFetch('/plans');
  const listRate = (p) => (pricing?.plans || []).find((x) => x.id === p)?.rate_per_student || 0;
  const [f, setF] = useState({ school_name: '', city: '', state: '', board: '', student_count: '', source: 'Walk-in', temperature: 'Warm', current_system: '', location_url: '', next_follow_up: '', follow_up_note: '', owner_id: '', notes: '' });
  const [c, setC] = useState({ name: '', designation: '', phone: '', email: '', decision_maker: true });
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setContact = (k) => (e) => setC((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = { ...f, student_count: Number(f.student_count || 0), contacts: c.name.trim() ? [c] : [], products: toApi(lines) };
      if (!body.owner_id) delete body.owner_id;
      if (!String(body.location_url || '').trim()) delete body.location_url;
      const { data } = await pApi.post('/leads', body);
      notify('School added to your pipeline', 'success');
      navigate(`/platform/sales/${data.id}`);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  const section = (t) => <p className="border-b border-[#EEEAE0] pb-1.5 pt-2 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080] sm:col-span-2">{t}</p>;
  return (
    <Modal title="Add a school you are talking to" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {section('The school')}
        <Field label="School name"><input autoFocus value={f.school_name} onChange={set('school_name')} className={inputCls} /></Field>
        <Field label="City / area"><input value={f.city} onChange={set('city')} className={inputCls} /></Field>
        <Field label="State"><input value={f.state} onChange={set('state')} className={inputCls} /></Field>
        <Field label="Board"><input value={f.board} onChange={set('board')} placeholder="CBSE, ICSE, State…" className={inputCls} /></Field>
        <Field label="Approx. students"><input type="number" min="0" value={f.student_count} onChange={set('student_count')} className={inputCls} /></Field>
        <Field label="How did you find them?"><select value={f.source} onChange={set('source')} className={inputCls}>{options.sources.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="What do they use now?"><input value={f.current_system} onChange={set('current_system')} placeholder="Excel, another ERP, paper…" className={inputCls} /></Field>
        <Field label="How interested are they?">
          <div className="flex gap-2">{options.temperatures.map((t) => <button key={t} type="button" aria-pressed={f.temperature === t} onClick={() => setF((s) => ({ ...s, temperature: t }))} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-[13.5px] font-medium transition" style={{ borderColor: f.temperature === t ? TEMP_COLOR[t] : '#DAD6CC', background: f.temperature === t ? `${TEMP_COLOR[t]}14` : '#fff' }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: TEMP_COLOR[t] }} />{t}</button>)}</div>
        </Field>
        <div className="sm:col-span-2"><Field label="School location (optional)" hint="Paste a Google Maps link. You can also add it later and take photos from the school page."><input value={f.location_url} onChange={set('location_url')} placeholder="https://maps.app.goo.gl/…" className={inputCls} /></Field></div>
        {section('Who did you meet?')}
        <Field label="Name"><input value={c.name} onChange={setContact('name')} className={inputCls} /></Field>
        <Field label="Role"><input value={c.designation} onChange={setContact('designation')} placeholder="Principal, Chairman, Accountant…" className={inputCls} /></Field>
        <Field label="Phone"><input value={c.phone} onChange={setContact('phone')} className={inputCls} /></Field>
        <Field label="Email"><input type="email" value={c.email} onChange={setContact('email')} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-[13.5px] sm:col-span-2"><input type="checkbox" checked={c.decision_maker} onChange={setContact('decision_maker')} />This person decides on buying</label>
        {section('What did you pitch, and at what price?')}
        <div className="sm:col-span-2"><PriceList lines={lines} setLines={setLines} listRate={listRate} gst={pricing?.settings?.gst_percent ?? 18} /></div>
        {section('Next step')}
        <Field label="Follow up on"><input type="date" value={f.next_follow_up} onChange={set('next_follow_up')} className={inputCls} /></Field>
        <Field label="What to do then"><input value={f.follow_up_note} onChange={set('follow_up_note')} placeholder="e.g. Call about the demo date" className={inputCls} /></Field>
        {ownerView && <Field label="Salesperson"><select value={f.owner_id} onChange={set('owner_id')} className={inputCls}><option value="">Me</option>{salespeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <div className="sm:col-span-2"><Field label="Notes"><textarea value={f.notes} onChange={set('notes')} rows={2} className={`${inputCls} h-auto py-2`} /></Field></div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Add school</Btn></div>
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------- pipeline page
const Tile = ({ icon: Icon, label, value, hint, accent }) => (
  <div className="relative overflow-hidden rounded-2xl border border-[#E2DDD1] bg-white px-5 py-4">
    <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
    <div className="flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">{label}</p><Icon className="h-[18px] w-[18px]" style={{ color: accent }} /></div>
    <p style={serif} className="mt-1.5 text-[28px] font-medium leading-none text-[#1F2433]">{value}</p>
    <p className="mt-2 text-[12.5px] text-[#6B7080]">{hint}</p>
  </div>
);

const DueCard = ({ row, today, ownerView }) => (
  <div className={`rounded-2xl border bg-white p-4 ${row.follow_up_overdue ? 'border-red-200' : 'border-amber-200'}`}>
    <div className="flex items-start justify-between gap-2">
      <Link to={`/platform/sales/${row.id}`} className="min-w-0 font-semibold text-[#1F2433] hover:text-[#2E2A6E] hover:underline">{row.school_name}</Link>
      <FollowChip row={row} today={today} />
    </div>
    <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-[#6B7080]"><MapPin className="h-3 w-3" />{row.city || '—'}{ownerView && <span className="ml-1.5">· {row.owner_name}</span>}</p>
    <p className="mt-2.5 text-[13.5px] leading-5 text-[#2B3040]">{row.follow_up_note || 'Follow up'}</p>
    <div className="mt-3 flex items-center justify-between">
      <span className="text-[12.5px] text-[#5B6070]">{row.contact_name}{row.contact_phone ? ` · ${row.contact_phone}` : ''}</span>
      <span className="flex gap-1.5">
        {row.contact_phone && <a href={tel(row.contact_phone)} aria-label={`Call ${row.contact_name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E2A6E] text-white hover:bg-[#24205A]"><Phone className="h-4 w-4" /></a>}
        {row.contact_phone && <a href={wa(row.contact_phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${row.contact_name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16A34A] text-white hover:bg-[#15803D]"><MessageCircle className="h-4 w-4" /></a>}
        <Link to={`/platform/sales/${row.id}`} aria-label="Open" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DAD6CC] text-[#2E2A6E] hover:bg-[#F4F1EA]"><ArrowRight className="h-4 w-4" /></Link>
      </span>
    </div>
  </div>
);

const LeadCard = ({ row, today, ownerView, dragging, onDragStart, onDragEnd }) => (
  <div draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', row.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(row.id); }} onDragEnd={onDragEnd}
    className={`cursor-grab rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(31,36,51,0.04)] transition hover:shadow-md active:cursor-grabbing ${dragging ? 'opacity-40' : ''} ${row.follow_up_overdue ? 'border-red-200' : 'border-[#E2DDD1]'}`}>
    <div className="flex items-start justify-between gap-2">
      <Link to={`/platform/sales/${row.id}`} draggable={false} className="min-w-0 text-[14px] font-semibold leading-5 text-[#1F2433] hover:text-[#2E2A6E] hover:underline">{row.school_name}</Link>
      <span title={`${row.temperature} lead`} className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TEMP_COLOR[row.temperature] }} />
    </div>
    <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[#6B7080]"><span className="min-w-0 truncate">{[row.city, row.state].filter(Boolean).join(', ') || row.source}</span>{row.location_url && <MapPin className="h-3 w-3 shrink-0 text-emerald-600" aria-label="Location saved" />}{row.photo_count > 0 && <span className="inline-flex shrink-0 items-center gap-0.5"><Camera className="h-3 w-3" />{row.photo_count}</span>}</p>
    <div className="mt-2.5"><Chips products={row.products} /></div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <b className="text-[15px] text-[#1F2433]">{row.quoted_total ? short(row.quoted_total) : <span className="text-[12px] font-normal text-[#8A8F9C]">Not quoted</span>}</b>
      <FollowChip row={row} today={today} />
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-[#F0ECE2] pt-2.5 text-[12px] text-[#6B7080]">
      <span className="min-w-0 truncate">{row.contact_name || 'No contact yet'}</span>
      <span className="flex items-center gap-2">{row.contact_phone && <a href={tel(row.contact_phone)} draggable={false} aria-label={`Call ${row.contact_name}`} className="text-[#2E2A6E] hover:text-[#16A34A]"><Phone className="h-3.5 w-3.5" /></a>}{ownerView && <Avatar name={row.owner_name} size={22} />}</span>
    </div>
  </div>
);

const Board = ({ data, today, ownerView, onMove }) => {
  const [dragId, setDragId] = useState('');
  const [over, setOver] = useState('');
  return (
    <div className="-mx-1 flex gap-3.5 overflow-x-auto px-1 pb-3">
      {data.options.stages.map((stage) => {
        const rows = data.items.filter((r) => r.stage === stage);
        const value = rows.reduce((a, r) => a + (r.quoted_total || 0), 0);
        const st = STAGE_STYLE[stage];
        return (
          <section key={stage} aria-label={stage} onDragOver={(e) => { e.preventDefault(); setOver(stage); }} onDragLeave={() => setOver('')} onDrop={(e) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/plain') || dragId; setDragId(''); if (id) onMove(id, stage); }}
            className={`flex w-[290px] shrink-0 flex-col rounded-2xl border p-2.5 transition ${over === stage ? 'border-[#3F3A8C] bg-[#F1EEFA]' : 'border-[#E8E3D6] bg-[#F8F5EE]'}`}>
            <header className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1F2433]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: st.c }} />{stage}<span className="rounded-full bg-white px-2 py-0.5 text-[11.5px] font-medium text-[#6B7080]">{rows.length}</span></span>
              <span className="text-[12px] font-medium text-[#6B7080]">{value ? short(value) : ''}</span>
            </header>
            <div className="min-h-[60px] space-y-2.5">
              {rows.map((r) => <LeadCard key={r.id} row={r} today={today} ownerView={ownerView} dragging={dragId === r.id} onDragStart={setDragId} onDragEnd={() => { setDragId(''); setOver(''); }} />)}
              {rows.length === 0 && <p className="rounded-xl border border-dashed border-[#D8D3C6] px-3 py-5 text-center text-[12.5px] text-[#8A8F9C]">Drop a school here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export const SalesPipeline = () => {
  const navigate = useNavigate();
  const [view, setView] = useState(() => { try { return localStorage.getItem('orison_sales_view') || 'board'; } catch { return 'board'; } });
  const [stage, setStage] = useState('open');
  const [f, setF] = useState({ q: '', owner_id: '', plan: '', temperature: '', followup: '', period: '', sort: 'followup' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [allDue, setAllDue] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQuery(f.q), 300); return () => clearTimeout(t); }, [f.q]);
  useEffect(() => { setPage(0); }, [stage, query, f.owner_id, f.plan, f.temperature, f.followup, f.period, f.sort, view]);
  const chooseView = (v) => { setView(v); try { localStorage.setItem('orison_sales_view', v); } catch { /* ignore */ } };
  const common = { q: query, owner_id: f.owner_id, plan: f.plan, temperature: f.temperature, followup: f.followup, sort: f.sort, ...(f.period ? { from: ago(Number(f.period)), to: ago(0) } : {}) };
  const params = view === 'board' ? { ...common, stage: '', skip: 0, limit: 200 } : { ...common, stage: stage === 'all' ? '' : stage, skip: page * PAGE, limit: PAGE };
  const { data, loading, error, reload } = useFetch('/leads', params);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const sum = data.summary;
  const today = data.today;
  const ownerView = data.owner_view;
  const due = sum.follow_ups.overdue + sum.follow_ups.today;
  const pages = Math.max(1, Math.ceil(data.total / PAGE));

  const move = async (id, to) => {
    const lead = data.items.find((r) => r.id === id);
    if (!lead || lead.stage === to) return;
    try {
      if (to === 'Lost') {
        const reason = await askText(`Why was ${lead.school_name} lost?`, '', { title: 'Lost: reason' });
        if (!reason || !reason.trim()) return;
        await pApi.put(`/leads/${id}`, { stage: to, lost_reason: reason.trim() });
      } else await pApi.put(`/leads/${id}`, { stage: to });
      notify(`${lead.school_name} moved to ${to}`, 'success'); reload();
    } catch (err) { notify(errText(err), 'error'); }
  };

  const tabs = [['open', 'Open', sum.open], ['all', 'All', sum.total], ...data.options.stages.map((s) => [s, s, sum.by_stage[s]])];
  const maxProduct = Math.max(1, ...sum.by_product.map((p) => p.value));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 style={serif} className="text-[30px] font-medium leading-tight text-[#1F2433]">Sales pipeline</h1>
          <p className="mt-1 text-[14px] text-[#5B6070]">{due > 0 ? <><b className="text-[#B91C1C]">{sum.follow_ups.overdue} overdue</b> and <b className="text-[#B45309]">{sum.follow_ups.today} due today</b>. Start with the follow-ups below.</> : ownerView ? 'Every school your team is working on, who they met, what they pitched and what they quoted.' : 'Nothing is overdue. Add the schools you visit and keep the next follow-up date up to date.'}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg border border-[#DAD6CC] bg-white p-1" role="group" aria-label="View">
            {[['board', LayoutGrid, 'Board'], ['list', List, 'List'], ['routes', RouteIcon, 'Routes']].map(([key, Icon, label]) => <button key={key} type="button" onClick={() => chooseView(key)} aria-pressed={view === key} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${view === key ? 'bg-[#2E2A6E] text-white' : 'text-[#5B6070] hover:bg-[#F4F1EA]'}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
          <Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add a school</Btn>
        </div>
      </div>

      {view === 'routes' ? <RoutesView ownerView={ownerView} salespeople={data.salespeople} /> : (<>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={BellRing} label="Follow-ups due" value={num(due)} accent={sum.follow_ups.overdue ? '#DC2626' : due ? '#F59E0B' : '#10B981'} hint={`${sum.follow_ups.next_7_days} more in the next 7 days`} />
        <Tile icon={Building2} label="Open schools" value={num(sum.open)} accent="#3F3A8C" hint={`${sum.visits_30d} visits and demos in 30 days`} />
        <Tile icon={CircleDollarSign} label="Pipeline value" value={short(sum.pipeline_value)} accent="#0E7490" hint={`${inr(sum.pipeline_value)} before GST`} />
        <Tile icon={Trophy} label="Won in 30 days" value={num(sum.won_30d)} accent="#047857" hint={`${inr(sum.won_value_30d)} before GST`} />
      </div>

      {data.due.length > 0 && (
        <section className="mt-7" aria-label="Follow-ups due">
          <div className="mb-3 flex items-center justify-between"><h2 style={serif} className="text-[20px] font-medium text-[#1F2433]">Follow up today</h2>{data.due.length > 3 && <button type="button" onClick={() => setAllDue((v) => !v)} className="text-[13px] font-medium text-[#3F3A8C] hover:underline">{allDue ? 'Show fewer' : `Show all ${data.due.length}`}</button>}</div>
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">{(allDue ? data.due : data.due.slice(0, 3)).map((r) => <DueCard key={r.id} row={r} today={today} ownerView={ownerView} />)}</div>
        </section>
      )}

      {ownerView && sum.by_owner && (
        <div className="mt-7">
          <section className="rounded-2xl border border-[#E2DDD1] bg-white p-5" aria-label="Sales team">
            <div className="mb-4 flex items-baseline justify-between"><h2 style={serif} className="text-[20px] font-medium text-[#1F2433]">Your sales team</h2><span className="text-[12.5px] text-[#6B7080]">Click a person to see only their schools</span></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sum.by_owner.map((o) => (
                <button key={o.owner_id} type="button" aria-pressed={f.owner_id === o.owner_id} onClick={() => setF((s) => ({ ...s, owner_id: s.owner_id === o.owner_id ? '' : o.owner_id }))}
                  className={`rounded-xl border p-4 text-left transition ${f.owner_id === o.owner_id ? 'border-[#3F3A8C] bg-[#F6F4FC]' : 'border-[#E2DDD1] hover:bg-[#FAF8F3]'}`}>
                  <div className="flex items-center gap-3"><Avatar name={o.name} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-semibold text-[#1F2433]">{o.name}</p><p className="text-[12.5px] text-[#6B7080]">{o.leads} schools · {o.open} open</p></div>{o.overdue > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11.5px] font-semibold text-red-700">{o.overdue} overdue</span>}</div>
                  <div className="mt-3.5 grid grid-cols-5 gap-2 text-center">
                    {[['Visits', o.visits_30d], ['Proposals', o.proposals], ['Won', o.won_30d], ['Pipeline', short(o.pipeline_value)], ['Km 30d', o.km_30d ?? 0]].map(([k, v]) => <div key={k} className="rounded-lg bg-[#F8F5EE] py-1.5"><p className="text-[14px] font-semibold text-[#1F2433]">{v}</p><p className="text-[9.5px] uppercase text-[#6B7080]">{k}</p></div>)}
                  </div>
                </button>
              ))}
            </div>
          </section>
                </div>
      )}

      <div className="mb-4 mt-7 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" /><input value={f.q} onChange={set('q')} placeholder="Search school, city, person or phone" className={`${inputCls} pl-9`} /></div>
        {ownerView && <select value={f.owner_id} onChange={set('owner_id')} aria-label="Salesperson" className={`${selectCls} w-44`}><option value="">All salespeople</option>{data.salespeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <select value={f.plan} onChange={set('plan')} aria-label="Product pitched" className={`${selectCls} w-44`}><option value="">Any product</option><ProductOptions /></select>
        <select value={f.followup} onChange={set('followup')} aria-label="Follow-up" className={`${selectCls} w-48`}>{[['', 'Any follow-up date'], ['overdue', 'Overdue'], ['today', 'Today'], ['week', 'Next 7 days'], ['none', 'No date set']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={f.temperature} onChange={set('temperature')} aria-label="Interest" className={`${selectCls} w-36`}><option value="">Any interest</option>{data.options.temperatures.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={f.period} onChange={set('period')} aria-label="Added" className={`${selectCls} w-44`}>{[['', 'Added any time'], ['6', 'Added last 7 days'], ['29', 'Added last 30 days'], ['89', 'Added last 90 days']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {view === 'list' && <select value={f.sort} onChange={set('sort')} aria-label="Sort" className={`${selectCls} w-44`}><option value="followup">Follow-up first</option><option value="recent">Recently updated</option><option value="value">Highest quote</option></select>}
      </div>

      {view === 'board' ? (
        data.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>{sum.total === 0 ? 'No schools yet. Add the first school you visit.' : 'No school matches these filters.'}</Empty></div>
          : <Board data={data} today={today} ownerView={ownerView} onMove={move} />
      ) : (<>
        <div className="mb-3 flex flex-wrap gap-2">
          {tabs.map(([key, label, count]) => <button key={key} type="button" onClick={() => setStage(key)} aria-pressed={stage === key} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${stage === key ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}>{label} <span className={stage === key ? 'text-white/70' : 'text-[#6B7080]'}>{num(count)}</span></button>)}
        </div>
        {data.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>{sum.total === 0 ? 'No schools yet. Add the first school you visit.' : 'No school matches these filters.'}</Empty></div> : (<>
          <TableWrap>
            <THead cols={['School', 'Person met', 'Stage', 'Pitched', 'Quote (before GST)', 'Follow up', 'Last contact', ...(ownerView ? ['Salesperson'] : [])]} />
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/platform/sales/${r.id}`)} className="cursor-pointer hover:bg-[#FAF8F3]">
                  <Td className="min-w-[200px]"><Link to={`/platform/sales/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#2E2A6E] hover:underline">{r.school_name}</Link><div className="flex items-center gap-2 text-[12px] text-[#6B7080]"><TempDot temp={r.temperature} />{[r.city, r.state].filter(Boolean).join(', ')}</div></Td>
                  <Td className="whitespace-nowrap">{r.contact_name || <span className="text-[#8A8F9C]">—</span>}{r.contact_phone && <div className="text-[12px] text-[#6B7080]">{r.contact_phone}</div>}</Td>
                  <Td><StagePill stage={r.stage} /></Td>
                  <Td className="min-w-[160px]"><Chips products={r.products} /></Td>
                  <Td className="whitespace-nowrap font-medium">{r.quoted_total ? inr(r.quoted_total) : <span className="font-normal text-[#8A8F9C]">Not quoted</span>}</Td>
                  <Td className="whitespace-nowrap"><FollowChip row={r} today={today} /></Td>
                  <Td className="whitespace-nowrap">{r.last_activity_at ? fmtDate(r.last_activity_at) : <span className="text-[#8A8F9C]">Not yet</span>}<div className="text-[12px] text-[#6B7080]">{r.meetings} logged</div></Td>
                  {ownerView && <Td className="whitespace-nowrap"><span className="flex items-center gap-2"><Avatar name={r.owner_name} size={24} />{r.owner_name}</span></Td>}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div className="mt-3 flex items-center justify-between text-[13px] text-[#5B6070]">
            <span>{num(data.total)} schools · page {page + 1} of {pages}</span>
            <span className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 font-medium disabled:opacity-40">Previous</button>
              <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
            </span>
          </div>
        </>)}
      </>)}

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E2DDD1] bg-white p-5" aria-label="Product mix">
          <h2 style={serif} className="mb-4 text-[20px] font-medium text-[#1F2433]">What is being pitched</h2>
          {sum.by_product.length === 0 ? <Empty>No product pitched yet.</Empty> : (
            <ul className="space-y-3.5">{sum.by_product.map((p) => (
              <li key={p.product}>
                <div className="mb-1 flex items-baseline justify-between text-[13.5px]"><span className="font-medium text-[#1F2433]">{p.label}</span><span className="text-[#5B6070]">{short(p.value)} · {p.leads} {p.leads === 1 ? 'school' : 'schools'}</span></div>
                <div className="h-2.5 rounded-full bg-[#EEEAE0]"><div className="h-2.5 rounded-full" style={{ width: `${(p.value * 100) / maxProduct}%`, background: PRODUCT_COLOR[p.product] }} /></div>
              </li>
            ))}</ul>
          )}
        </section>
        {data.recent.length > 0 && (
        <section className="rounded-2xl border border-[#E2DDD1] bg-white p-5" aria-label="Recent activity">
          <h2 style={serif} className="mb-3 text-[20px] font-medium text-[#1F2433]">{ownerView ? 'Latest visits and calls across the team' : 'Your latest visits and calls'}</h2>
          <ul className="space-y-3.5">
            {data.recent.slice(0, 5).map((a, i) => { const Icon = ACTIVITY_ICON[a.type] || MessageSquare; return (
              <li key={`${a.lead_id}${i}`} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEEAF8] text-[#3F3A8C]"><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 text-[13.5px] leading-5"><p><b>{a.by}</b> · {a.type.toLowerCase()} · <Link to={`/platform/sales/${a.lead_id}`} className="font-medium text-[#2E2A6E] hover:underline">{a.school_name}</Link></p>
                  <p className="text-[12.5px] text-[#6B7080]">{a.met_name ? `Met ${a.met_name}${a.met_designation ? ` (${a.met_designation})` : ''} · ` : ''}{fmtDate(a.date)}</p><p className="truncate text-[#4A4F5C]">{a.summary}</p></div></li>
            ); })}
          </ul>
        </section>
        )}
      </div>

      </>)}

      {adding && <AddLeadModal options={data.options} salespeople={data.salespeople} ownerView={ownerView} onClose={() => setAdding(false)} />}
    </>
  );
};

// ---------------------------------------------------------------- one school
const ConvertModal = ({ lead, onClose, onDone }) => {
  const erpLine = [...lead.products].filter((p) => ERP.includes(p.product)).sort((a, b) => b.total - a.total)[0];
  const [code, setCode] = useState(lead.school_name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20));
  const [plan, setPlan] = useState(erpLine ? erpLine.product : 'essential');
  const [status, setStatus] = useState('Trial');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const { data } = await pApi.post(`/leads/${lead.id}/convert`, { code, plan, status }); notify('School created from this lead', 'success'); onDone(data.school_id); } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title="School signed: create it in Schools" onClose={onClose}>
      <form onSubmit={go} className="space-y-4">
        <p className="text-[14px] leading-6 text-[#5B6070]">{erpLine
          ? `This creates the school with its contact person, the ERP plan, the student count and the negotiated ERP price (${inr(erpLine.total)} before GST). The other products stay on the lead. The lead is marked Won.`
          : 'No ERP plan was pitched, so choose the ERP plan the school starts on. The products you quoted stay on the lead, and the lead is marked Won.'}</p>
        <Field label="School code" hint="Short and unique, like greenvalley."><input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} /></Field>
        <Field label="ERP plan"><select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>{ERP.map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}</select></Field>
        <Field label="Start as"><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}><option>Trial</option><option>Active</option></select></Field>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13.5px] text-red-800">{error}</p>}
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Create school</Btn></div>
      </form>
    </Modal>
  );
};

const Card = ({ title, action, children, className = '' }) => (
  <section className={`rounded-2xl border border-[#E2DDD1] bg-white ${className}`}>
    <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4"><h2 className="text-[15px] font-semibold text-[#1F2433]">{title}</h2>{action}</header>
    <div className="p-5 pt-3">{children}</div>
  </section>
);

const Stepper = ({ stage, onChange }) => {
  const idx = OPEN.indexOf(stage);
  const closed = idx < 0;
  return (
    <nav aria-label="Stage" className="flex flex-wrap items-center gap-y-3">
      {OPEN.map((s, i) => {
        const done = !closed && i < idx; const current = s === stage; const st = STAGE_STYLE[s];
        return (
          <React.Fragment key={s}>
            <button type="button" onClick={() => onChange(s)} aria-current={current ? 'step' : undefined} className="group flex items-center gap-2 rounded-full pr-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-bold transition" style={{ borderColor: current || done ? st.c : '#D8D3C6', background: done ? st.c : current ? st.bg : '#fff', color: done ? '#fff' : current ? st.c : '#8A8F9C' }}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className={`text-[13px] ${current ? 'font-semibold text-[#1F2433]' : 'text-[#6B7080] group-hover:text-[#1F2433]'}`}>{s}</span>
            </button>
            {i < OPEN.length - 1 && <span className="mx-1 hidden h-0.5 w-6 rounded bg-[#E2DDD1] sm:block" style={{ background: !closed && i < idx ? STAGE_STYLE[OPEN[i + 1]].c : undefined }} />}
          </React.Fragment>
        );
      })}
      <span className="ml-auto flex gap-2 pl-4">
        <button type="button" onClick={() => onChange('Won')} aria-pressed={stage === 'Won'} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${stage === 'Won' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'}`}>Won</button>
        <button type="button" onClick={() => onChange('Lost')} aria-pressed={stage === 'Lost'} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${stage === 'Lost' ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 bg-white text-red-700 hover:bg-red-50'}`}>Lost</button>
      </span>
    </nav>
  );
};

export const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePlatform();
  const ownerView = can('schools:create');
  const { data: lead, loading, error, reload } = useFetch(`/leads/${id}`);
  const { data: meta } = useFetch('/leads', { limit: 1 });
  const { data: pricing } = useFetch('/plans');
  const [converting, setConverting] = useState(false);
  if (loading && !lead) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const options = meta?.options;
  const today = meta?.today || iso(new Date());
  const gst = pricing?.settings?.gst_percent ?? lead.quote.gst_percent;
  const listRate = (p) => (pricing?.plans || []).find((x) => x.id === p)?.rate_per_student || 0;
  const save = async (body, ok) => { try { await pApi.put(`/leads/${id}`, body); notify(ok, 'success'); reload(); return true; } catch (err) { notify(errText(err), 'error'); return false; } };
  const changeStage = async (stage) => {
    if (stage === lead.stage) return;
    if (stage === 'Lost') { const reason = await askText('Why was this school lost?', '', { title: 'Lost: reason' }); if (!reason || !reason.trim()) return; await save({ stage, lost_reason: reason.trim() }, 'Marked as lost'); return; }
    await save({ stage }, stage === 'Won' ? 'Marked as won' : 'Stage updated');
  };
  const primary = lead.contacts.find((c) => c.decision_maker) || lead.contacts[0];

  return (
    <>
      <p className="mb-3 text-[13px]"><Link to="/platform/sales" className="text-[#3F3A8C] hover:underline">← All schools</Link></p>
      <section className="rounded-2xl border border-[#E2DDD1] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 style={serif} className="text-[30px] font-medium leading-tight text-[#1F2433]">{lead.school_name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-[#5B6070]"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[lead.city, lead.state].filter(Boolean).join(', ') || 'Location not set'}</span>{lead.board && <span>{lead.board}</span>}{lead.student_count > 0 && <span>{num(lead.student_count)} students</span>}<span>Found via {lead.source || '—'}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {primary?.phone && <a href={tel(primary.phone)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2E2A6E] px-4 text-[14px] font-medium text-white hover:bg-[#24205A]"><Phone className="h-4 w-4" />Call {primary.name}</a>}
            {primary?.phone && <a href={wa(primary.phone)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#16A34A] px-4 text-[14px] font-medium text-white hover:bg-[#15803D]"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
            {lead.school_id ? <Link to={`/platform/schools/${lead.school_id}`} className="inline-flex h-10 items-center rounded-lg border border-[#DAD6CC] bg-white px-4 text-[14px] font-medium text-[#2E2A6E] hover:bg-[#F4F1EA]">Open school</Link>
              : ownerView && <Btn variant="ghost" onClick={() => setConverting(true)}>Create school from this</Btn>}
          </div>
        </div>
        <div className="mt-6"><Stepper stage={lead.stage} onChange={changeStage} /></div>
        {lead.stage === 'Lost' && lead.lost_reason && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-900"><b>Why we lost it:</b> {lead.lost_reason}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[#F0ECE2] pt-5">
          <div><p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7080]">Interest</p>
            <div className="flex gap-1.5">{(options?.temperatures || ['Hot', 'Warm', 'Cold']).map((t) => <button key={t} type="button" aria-pressed={lead.temperature === t} onClick={() => save({ temperature: t }, 'Interest updated')} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium" style={{ borderColor: lead.temperature === t ? TEMP_COLOR[t] : '#E2DDD1', background: lead.temperature === t ? `${TEMP_COLOR[t]}14` : '#fff' }}><span className="h-2 w-2 rounded-full" style={{ background: TEMP_COLOR[t] }} />{t}</button>)}</div></div>
          <div><p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7080]">Salesperson</p>
            {ownerView && meta?.salespeople?.length ? <select value={lead.owner_id} onChange={(e) => save({ owner_id: e.target.value }, 'Reassigned')} aria-label="Salesperson" className={`${selectCls} h-9 w-48`}>{meta.salespeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <span className="inline-flex items-center gap-2 text-[14px] font-medium"><Avatar name={lead.owner_name} size={26} />{lead.owner_name}</span>}</div>
          <div><p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7080]">Quoted</p><b style={serif} className="text-[22px] font-medium">{lead.quote.total ? inr(lead.quote.total) : '—'}</b><span className="ml-1.5 text-[12px] text-[#6B7080]">before GST</span></div>
          <div><p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7080]">Added</p><span className="text-[14px]">{fmtDate(lead.created_at)}</span></div>
        </div>
      </section>

      <FollowUpBanner lead={lead} today={today} save={save} />

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <LogActivity lead={lead} options={options} onSaved={reload} />
          <LocationCard lead={lead} save={save} />
          <PhotosCard lead={lead} onChanged={reload} />
          <Timeline lead={lead} />
        </div>
        <div className="space-y-5">
          <PitchCard lead={lead} listRate={listRate} gst={gst} save={save} />
          <PeopleCard lead={lead} save={save} />
          <DetailsCard lead={lead} options={options} save={save} />
        </div>
      </div>
      {converting && <ConvertModal lead={lead} onClose={() => setConverting(false)} onDone={(sid) => navigate(`/platform/schools/${sid}`)} />}
    </>
  );
};

const FollowUpBanner = ({ lead, today, save }) => {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState(lead.next_follow_up);
  const [note, setNote] = useState(lead.follow_up_note);
  const [close, setClose] = useState(lead.expected_close);
  useEffect(() => { setDate(lead.next_follow_up); setNote(lead.follow_up_note); setClose(lead.expected_close); setEdit(false); }, [lead.next_follow_up, lead.follow_up_note, lead.expected_close]);
  const closed = lead.stage === 'Won' || lead.stage === 'Lost';
  if (closed) return null;
  const tone = lead.follow_up_overdue ? { bg: '#FDF0F0', bd: '#F3C9C9', c: '#B91C1C' } : lead.follow_up_today ? { bg: '#FEF6E7', bd: '#F5DEB0', c: '#B45309' } : { bg: '#F6F4FC', bd: '#E0DAF3', c: '#3F3A8C' };
  return (
    <section className="mt-5 rounded-2xl border px-5 py-4" style={{ background: tone.bg, borderColor: tone.bd }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white" style={{ color: tone.c }}><CalendarClock className="h-5 w-5" /></span>
          <div><p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: tone.c }}>Next follow-up</p>
            <p className="text-[15px] font-semibold text-[#1F2433]">{lead.next_follow_up ? `${fmtDate(lead.next_follow_up)} · ${when(lead.next_follow_up, today)}` : 'Not set. Set a date so you do not forget this school.'}</p>
            {lead.follow_up_note && <p className="text-[13.5px] text-[#4A4F5C]">{lead.follow_up_note}</p>}</div></div>
        {!edit && <Btn variant="ghost" onClick={() => setEdit(true)}>{lead.next_follow_up ? 'Change' : 'Set follow-up'}</Btn>}
      </div>
      {edit && (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="What to do"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. Call the principal about the demo" /></Field></div>
          <Field label="Expected to decide by"><input type="date" value={close} onChange={(e) => setClose(e.target.value)} className={inputCls} /></Field>
          <div className="flex gap-2 sm:col-span-4"><Btn onClick={async () => { if (await save({ next_follow_up: date, follow_up_note: note, expected_close: close }, 'Follow-up saved')) setEdit(false); }}>Save</Btn><Btn variant="ghost" onClick={() => setEdit(false)}>Cancel</Btn></div>
        </div>
      )}
    </section>
  );
};

const LogActivity = ({ lead, options, onSaved }) => {
  const blank = { type: 'Visit', date: iso(new Date()), met_name: '', met_designation: '', summary: '', outcome: '', distance_km: '', next_follow_up: '', follow_up_note: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (f.summary.trim().length < 3) return notify('Write what happened.', 'error');
    setBusy(true);
    try {
      const body = { ...f }; if (!body.next_follow_up) { delete body.next_follow_up; delete body.follow_up_note; }
      if (body.distance_km === '' || !['Visit', 'Meeting', 'Demo'].includes(body.type)) delete body.distance_km; else body.distance_km = Number(body.distance_km);
      await pApi.post(`/leads/${lead.id}/activities`, body);
      notify('Saved to the history', 'success'); setF({ ...blank, date: f.date }); onSaved();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Card title="Log a visit, call or demo">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="What was it">
          {(options?.activity_types || ['Visit']).map((t) => { const Icon = ACTIVITY_ICON[t] || MessageSquare; const on = f.type === t; return (
            <button key={t} type="button" aria-pressed={on} onClick={() => setF((s) => ({ ...s, type: t }))} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${on ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}><Icon className="h-3.5 w-3.5" />{t}</button>
          ); })}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="When"><input type="date" max={iso(new Date())} value={f.date} onChange={set('date')} className={inputCls} /></Field>
          <Field label="Who you met"><input value={f.met_name} onChange={set('met_name')} placeholder="Name" className={inputCls} /></Field>
          <Field label="Their role"><input value={f.met_designation} onChange={set('met_designation')} placeholder="Principal, Chairman…" className={inputCls} /></Field>
        </div>
        {['Visit', 'Meeting', 'Demo'].includes(f.type) && <Field label="How far from the last school? (km, optional)" hint="From the previous school you visited today, or from where you started. Leave empty and it is worked out from the map pins."><input type="number" min="0" max="2000" step="0.1" value={f.distance_km} onChange={set('distance_km')} className={inputCls} placeholder="e.g. 12.5" /></Field>}
        <Field label="What happened"><textarea value={f.summary} onChange={set('summary')} rows={3} className={`${inputCls} h-auto py-2`} placeholder="What you showed, what they asked, what they said about price…" /></Field>
        <Field label="Result or next step (optional)"><input value={f.outcome} onChange={set('outcome')} className={inputCls} placeholder="e.g. Wants a demo for the trustees" /></Field>
        <div className="grid gap-3 rounded-xl bg-[#FAF8F3] p-3.5 sm:grid-cols-2">
          <Field label="Follow up on (optional)"><input type="date" value={f.next_follow_up} onChange={set('next_follow_up')} className={inputCls} /></Field>
          <Field label="What to do then"><input value={f.follow_up_note} onChange={set('follow_up_note')} className={inputCls} placeholder="e.g. Call about the demo date" /></Field>
        </div>
        <Btn type="submit" busy={busy}><ClipboardList className="h-4 w-4" />Save to history</Btn>
      </form>
    </Card>
  );
};

const Timeline = ({ lead }) => (
  <Card title="History">
    {lead.activities.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
      <ol className="relative ml-4 space-y-5 border-l-2 border-[#EEEAE0] pl-6">
        {lead.activities.map((a) => {
          const system = a.type === 'System';
          const Icon = ACTIVITY_ICON[a.type] || ArrowRight;
          return (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[39px] flex items-center justify-center rounded-full border-2 border-white ${system ? 'top-0.5 h-4 w-4 bg-[#D8D3C6]' : 'h-8 w-8 bg-[#EEEAF8] text-[#3F3A8C]'}`}>{!system && <Icon className="h-4 w-4" />}</span>
              {system ? <p className="text-[13px] text-[#6B7080]">{a.summary} <span className="text-[#A5A08F]">· {a.by} · {fmtDate(a.date)}</span></p> : (
                <div className="rounded-xl border border-[#E2DDD1] bg-white px-4 py-3">
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-[#6B7080]"><b className="text-[#1F2433]">{a.type}</b><span>{fmtDate(a.date)}</span>{(a.met_name || a.met_designation) && <span>· met <b className="text-[#1F2433]">{a.met_name}</b>{a.met_designation ? ` (${a.met_designation})` : ''}</span>}</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-6 text-[#1F2433]">{a.summary}</p>
                  {a.outcome && <p className="mt-1.5 text-[13.5px] text-[#2E2A6E]"><b>Result:</b> {a.outcome}</p>}
                  {a.distance_km != null && <p className="mt-1.5 text-[13px] text-[#5B6070]">Travelled <b>{a.distance_km} km</b> to get here</p>}
                  <p className="mt-2 text-[12px] text-[#8A8F9C]">Logged by {a.by} · {fmtDateTime(a.at)}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    )}
  </Card>
);

const PitchCard = ({ lead, listRate, gst, save }) => {
  const [lines, setLines] = useState(() => fromApi(lead.products));
  const sig = JSON.stringify(lead.products.map((p) => [p.product, p.quantity, p.rate, p.discount_percent, p.note]));
  useEffect(() => { setLines(fromApi(lead.products)); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(toApi(lines).map((p) => [p.product, p.quantity, p.rate, p.discount_percent, p.note])) !== sig;
  return (
    <Card title="What you pitched and the price" action={dirty && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800">Unsaved</span>}>
      <PriceList lines={lines} setLines={setLines} listRate={listRate} gst={gst} />
      <div className="mt-4 flex gap-2"><Btn disabled={!dirty} onClick={() => save({ products: toApi(lines) }, 'Pitch and prices saved')}>Save products and prices</Btn>{dirty && <Btn variant="ghost" onClick={() => setLines(fromApi(lead.products))}>Undo</Btn>}</div>
    </Card>
  );
};

const PeopleCard = ({ lead, save }) => {
  const [rows, setRows] = useState(lead.contacts);
  const [edit, setEdit] = useState(false);
  useEffect(() => { setRows(lead.contacts); }, [lead.contacts]);
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <Card title="People we met" action={<button type="button" onClick={() => { setEdit(true); setRows((r) => [...r, { name: '', designation: '', phone: '', email: '', decision_maker: false }]); }} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#3F3A8C] hover:underline"><Plus className="h-3.5 w-3.5" />Add person</button>}>
      {!edit ? (rows.length === 0 ? <Empty>No one added yet.</Empty> : (
        <ul className="space-y-3">{rows.map((c, i) => (
          <li key={i} className="flex items-center gap-3"><Avatar name={c.name} size={38} />
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-[#1F2433]">{c.name}{c.decision_maker && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-emerald-700">Decides</span>}</p><p className="truncate text-[12.5px] text-[#6B7080]">{[c.designation, c.phone].filter(Boolean).join(' · ')}</p></div>
            {c.phone && <a href={tel(c.phone)} aria-label={`Call ${c.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E2A6E] text-white"><Phone className="h-3.5 w-3.5" /></a>}
            {c.phone && <a href={wa(c.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16A34A] text-white"><MessageCircle className="h-3.5 w-3.5" /></a>}
          </li>))}</ul>
      )) : (
        <div className="space-y-3">
          {rows.map((c, i) => (
            <div key={i} className="rounded-xl border border-[#E2DDD1] p-3">
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Name" value={c.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="Name" className={`${inputCls} col-span-2 h-9`} />
                <input aria-label="Role" value={c.designation} onChange={(e) => set(i, 'designation', e.target.value)} placeholder="Role" className={`${inputCls} h-9`} />
                <input aria-label="Phone" value={c.phone} onChange={(e) => set(i, 'phone', e.target.value)} placeholder="Phone" className={`${inputCls} h-9`} />
                <input aria-label="Email" value={c.email} onChange={(e) => set(i, 'email', e.target.value)} placeholder="Email" className={`${inputCls} col-span-2 h-9`} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px]"><label className="flex items-center gap-2"><input type="checkbox" checked={c.decision_maker} onChange={(e) => set(i, 'decision_maker', e.target.checked)} />Decides on buying</label>
                <button type="button" aria-label="Remove person" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded-md p-1 text-[#B91C1C] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          ))}
          <div className="flex gap-2"><Btn onClick={async () => { if (await save({ contacts: rows.filter((r) => r.name.trim()) }, 'People saved')) setEdit(false); }}>Save people</Btn><Btn variant="ghost" onClick={() => { setRows(lead.contacts); setEdit(false); }}>Cancel</Btn></div>
        </div>
      )}
      {!edit && rows.length > 0 && <button type="button" onClick={() => setEdit(true)} className="mt-3 text-[13px] font-medium text-[#3F3A8C] hover:underline">Edit people</button>}
    </Card>
  );
};

const DetailsCard = ({ lead, options, save }) => {
  const keys = ['school_name', 'city', 'state', 'board', 'address', 'student_count', 'source', 'current_system', 'notes'];
  const [f, setF] = useState(() => Object.fromEntries(keys.map((k) => [k, lead[k] ?? ''])));
  useEffect(() => { setF(Object.fromEntries(keys.map((k) => [k, lead[k] ?? '']))); }, [lead]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const body = useMemo(() => ({ ...f, student_count: Number(f.student_count || 0) }), [f]);
  return (
    <Card title="School details">
      <div className="space-y-3">
        <Field label="School name"><input value={f.school_name} onChange={set('school_name')} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><input value={f.city} onChange={set('city')} className={inputCls} /></Field>
          <Field label="State"><input value={f.state} onChange={set('state')} className={inputCls} /></Field>
          <Field label="Board"><input value={f.board} onChange={set('board')} className={inputCls} /></Field>
          <Field label="Students"><input type="number" min="0" value={f.student_count} onChange={set('student_count')} className={inputCls} /></Field>
        </div>
        <Field label="Address"><input value={f.address} onChange={set('address')} className={inputCls} /></Field>
        <Field label="How we found them"><select value={f.source} onChange={set('source')} className={inputCls}>{(options?.sources || [f.source]).map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="What they use now"><input value={f.current_system} onChange={set('current_system')} className={inputCls} /></Field>
        <Field label="Notes"><textarea value={f.notes} onChange={set('notes')} rows={3} className={`${inputCls} h-auto py-2`} /></Field>
        <Btn onClick={() => save(body, 'School details saved')}>Save details</Btn>
      </div>
    </Card>
  );
};

