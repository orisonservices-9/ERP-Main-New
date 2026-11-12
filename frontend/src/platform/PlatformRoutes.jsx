import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, ImagePlus, LocateFixed, MapPin, Navigation, Pencil, RotateCcw, Route as RouteIcon, Trash2, Users } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askConfirm, notify } from '../components/AppFeedback';
import { Btn, Empty, ErrorBox, Field, Loading, Modal, fmtDate, fmtDateTime, inputCls, num, selectCls, serif } from './ui';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// A photo is private: it is fetched with the signed-in session and shown from memory, never from a public link.
export const AuthImage = ({ path, alt, className = '' }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = ''; let alive = true;
    pApi.get(path, { responseType: 'blob' }).then((r) => { if (alive) { url = URL.createObjectURL(r.data); setSrc(url); } }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return src ? <img src={src} alt={alt} className={className} /> : <div className={`${className} animate-pulse bg-[#EEEAE0]`} aria-hidden="true" />;
};

const Card = ({ title, action, children }) => (
  <section className="rounded-2xl border border-[#E2DDD1] bg-white">
    <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4"><h2 className="text-[15px] font-semibold text-[#1F2433]">{title}</h2>{action}</header>
    <div className="p-5 pt-3">{children}</div>
  </section>
);

// ---------------------------------------------------------------- where the school is
export const LocationCard = ({ lead, save }) => {
  const [text, setText] = useState(lead.location_url || '');
  const [locating, setLocating] = useState(false);
  useEffect(() => { setText(lead.location_url || ''); }, [lead.location_url]);
  const hasPin = lead.latitude !== null && lead.latitude !== undefined;
  const useMine = () => {
    if (!navigator.geolocation) return notify('This browser cannot find your location. Paste a Google Maps link instead.', 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setText(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); setLocating(false); notify('Got your location. Press Save location.', 'success'); },
      () => { setLocating(false); notify('Could not get your location. Allow location for this site, or paste a Google Maps link.', 'error'); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  return (
    <Card title="Where the school is" action={hasPin ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700"><MapPin className="h-3 w-3" />Pinned</span> : <span className="rounded-full bg-[#F4F1EA] px-2.5 py-0.5 text-[11.5px] text-[#8A8F9C]">No pin yet</span>}>
      <div className="space-y-3">
        <Field label="Google Maps link or coordinates" hint="Open the school in Google Maps, tap Share, copy the link and paste it here. Or stand at the school and tap the button below.">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://maps.app.goo.gl/…  or  17.385, 78.4867" className={inputCls} />
        </Field>
        {hasPin && <p className="text-[12.5px] text-[#5B6070]">Pinned at <b>{lead.latitude.toFixed(6)}, {lead.longitude.toFixed(6)}</b>. Distances to this school are worked out from this pin.</p>}
        {!hasPin && lead.location_url && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">The link is saved, but a short link has no position in it. Paste the full link or use your location, so the distance between schools can be worked out.</p>}
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={useMine} busy={locating}><LocateFixed className="h-4 w-4" />Use my current location</Btn>
          <Btn onClick={() => save({ location_url: text }, 'Location saved')} disabled={text.trim() === (lead.location_url || '')}>Save location</Btn>
          {lead.location_url && <a href={lead.location_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DAD6CC] bg-white px-4 text-[14px] font-medium text-[#2E2A6E] hover:bg-[#F4F1EA]"><Navigation className="h-4 w-4" />Open in Maps</a>}
          {lead.location_url && <button type="button" onClick={() => save({ clear_location: true }, 'Location cleared')} className="px-1 text-[13px] text-[#B91C1C] hover:underline">Clear</button>}
        </div>
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------- photos taken at the school
export const PhotosCard = ({ lead, onChanged }) => {
  const { user, can } = usePlatform();
  const camera = useRef(null); const gallery = useRef(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const mine = (p) => p.by_id === user.id || can('schools:create');
  const upload = async (list) => {
    const files = Array.from(list || []); if (!files.length) return;
    setBusy(true); let done = 0;
    for (const file of files) {
      const form = new FormData(); form.append('file', file); form.append('caption', caption);
      try { await pApi.post(`/leads/${lead.id}/photos`, form); done += 1; } catch (err) { notify(`${file.name}: ${errText(err)}`, 'error'); }
    }
    setBusy(false); setCaption('');
    if (camera.current) camera.current.value = ''; if (gallery.current) gallery.current.value = '';
    if (done) { notify(`${done} ${done === 1 ? 'photo' : 'photos'} added`, 'success'); onChanged(); }
  };
  const remove = async (p) => {
    if (!(await askConfirm('Delete this photo? It cannot be brought back.'))) return;
    try { await pApi.delete(`/leads/${lead.id}/photos/${p.id}`); notify('Photo deleted', 'success'); setOpen(null); onChanged(); } catch (err) { notify(errText(err), 'error'); }
  };
  return (
    <Card title={`Photos from the school${lead.photos.length ? ` (${lead.photos.length})` : ''}`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1"><Field label="What is it a photo of? (optional)"><input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="e.g. Front gate, computer lab, signboard" className={inputCls} /></Field></div>
        <Btn onClick={() => camera.current?.click()} busy={busy}><Camera className="h-4 w-4" />Take a photo</Btn>
        <Btn variant="ghost" onClick={() => gallery.current?.click()} disabled={busy}><ImagePlus className="h-4 w-4" />Choose photos</Btn>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} data-testid="photo-camera" />
        <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} data-testid="photo-gallery" />
      </div>
      {lead.photos.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[#D8D3C6] px-4 py-6 text-center text-[13.5px] text-[#6B7080]">No photos yet. A photo of the school gate or signboard proves the visit and helps whoever goes next.</p> : (
        <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {lead.photos.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-[#E2DDD1] bg-[#F4F1EA]" aria-label={`Open photo ${p.caption || ''}`}>
                <AuthImage path={`/leads/${lead.id}/photos/${p.id}?size=thumb`} alt={p.caption || 'Photo at the school'} className="h-full w-full object-cover transition group-hover:scale-105" />
                {p.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-[11.5px] text-white">{p.caption}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Modal title={open.caption || 'Photo at the school'} onClose={() => setOpen(null)} wide>
          <AuthImage path={`/leads/${lead.id}/photos/${open.id}`} alt={open.caption || 'Photo at the school'} className="max-h-[65vh] w-full rounded-xl bg-[#F4F1EA] object-contain" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#5B6070]">
            <span>Added by <b className="text-[#1F2433]">{open.by}</b> · {fmtDateTime(open.uploaded_at)}{open.latitude !== null && open.latitude !== undefined && <span> · taken at {open.latitude.toFixed(4)}, {open.longitude.toFixed(4)}</span>}</span>
            {mine(open) && <Btn variant="danger" onClick={() => remove(open)}><Trash2 className="h-4 w-4" />Delete photo</Btn>}
          </div>
        </Modal>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------- the day's route: school 1 to 2 to 3, with the distance between each
const LegPill = ({ stop, onSave }) => {
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState('');
  const start = () => { setValue(stop.km !== null ? String(stop.km) : ''); setEdit(true); };
  if (edit) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3F3A8C] bg-white py-1 pl-3 pr-1.5">
        <input autoFocus onFocus={(e) => e.target.select()} type="number" min="0" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onSave(stop, value); setEdit(false); } if (e.key === 'Escape') setEdit(false); }} aria-label="Distance in km" className="w-20 text-[13px] outline-none" />
        <span className="text-[12px] text-[#6B7080]">km</span>
        <button type="button" aria-label="Save distance" onClick={() => { onSave(stop, value); setEdit(false); }} className="rounded-full bg-[#2E2A6E] p-1 text-white"><Check className="h-3.5 w-3.5" /></button>
        {stop.km_source === 'entered' && <button type="button" aria-label="Use the map estimate instead" title="Go back to the map estimate" onClick={() => { onSave(stop, ''); setEdit(false); }} className="rounded-full p-1 text-[#6B7080] hover:bg-[#F4F1EA]"><RotateCcw className="h-3.5 w-3.5" /></button>}
      </span>
    );
  }
  const known = stop.km !== null;
  const tone = !known ? ['#FBE3E3', '#B91C1C'] : stop.km_source === 'entered' ? ['#DAF3E8', '#047857'] : ['#FCEFD9', '#B45309'];
  return (
    <button type="button" onClick={start} className="group inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold transition hover:shadow" style={{ background: tone[0], color: tone[1] }} title="Click to type the real distance">
      {known ? `${stop.km} km` : stop.first ? 'Add distance from where you started' : 'Distance unknown. Add it'}
      {known && <span className="text-[11px] font-medium opacity-80">{stop.km_source === 'entered' ? 'typed' : 'straight line'}</span>}
      <Pencil className="h-3 w-3 opacity-60 group-hover:opacity-100" />
    </button>
  );
};

const DayCard = ({ day, ownerView, onSave }) => {
  const weekday = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
  return (
    <section className="rounded-2xl border border-[#E2DDD1] bg-white p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p style={serif} className="text-[19px] font-medium text-[#1F2433]">{weekday}, {fmtDate(day.date)}</p>
          <p className="text-[13px] text-[#5B6070]">{ownerView && <><b className="text-[#1F2433]">{day.owner_name}</b> · </>}{day.stops.length} {day.stops.length === 1 ? 'school' : 'schools'} visited{day.unknown_legs > 0 && <span className="text-red-700"> · {day.unknown_legs} distance{day.unknown_legs === 1 ? '' : 's'} missing</span>}</p></div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-[#2E2A6E] px-4 py-2 text-white"><span style={serif} className="text-[22px]">{day.total_km}</span><span className="ml-1 text-[12.5px] text-white/70">km</span></span>
          {day.directions_url && <a href={day.directions_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DAD6CC] bg-white px-3.5 text-[13.5px] font-medium text-[#2E2A6E] hover:bg-[#F4F1EA]"><Navigation className="h-4 w-4" />Open route in Maps</a>}
        </div>
      </header>
      <ol className="mt-5">
        {day.stops.map((s, i) => (
          <li key={s.activity_id}>
            <div className="ml-[15px] flex items-center gap-3 border-l-2 border-dashed border-[#D8D3C6] py-2.5 pl-6">
              <LegPill stop={s} onSave={onSave} />
              <span className="text-[12px] text-[#8A8F9C]">{s.first ? 'from where the day started' : `from ${day.stops[i - 1].school_name}`}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2E2A6E] text-[13px] font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1"><Link to={`/platform/sales/${s.lead_id}`} className="font-semibold text-[#1F2433] hover:text-[#2E2A6E] hover:underline">{s.school_name}</Link>
                <p className="text-[12.5px] text-[#6B7080]">{[s.city, s.type, s.time].filter(Boolean).join(' · ')}</p></div>
              {s.location_url ? <a href={s.location_url} target="_blank" rel="noreferrer" aria-label={`Open ${s.school_name} in Maps`} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DAD6CC] text-[#2E2A6E] hover:bg-[#F4F1EA]"><MapPin className="h-4 w-4" /></a>
                : <span title="No map pin for this school yet" className="flex h-8 w-8 items-center justify-center rounded-full text-[#C5C0B2]"><MapPin className="h-4 w-4" /></span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export const RoutesView = ({ ownerView, salespeople }) => {
  const [preset, setPreset] = useState('7');
  const [owner, setOwner] = useState('');
  const { data, loading, error, reload } = useFetch('/leads/routes', { from: ago(Number(preset) - 1), to: ago(0), owner_id: owner });
  const save = async (stop, value) => {
    try { await pApi.put(`/leads/${stop.lead_id}/activities/${stop.activity_id}/distance`, { distance_km: value === '' ? null : Number(value) }); notify(value === '' ? 'Back to the map estimate' : 'Distance saved', 'success'); reload(); } catch (err) { notify(errText(err), 'error'); }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[#DAD6CC] bg-white p-1" role="group" aria-label="Period">
          {[['1', 'Today'], ['7', 'Last 7 days'], ['14', 'Last 14 days'], ['30', 'Last 30 days']].map(([k, l]) => <button key={k} type="button" onClick={() => setPreset(k)} aria-pressed={preset === k} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${preset === k ? 'bg-[#2E2A6E] text-white' : 'text-[#5B6070] hover:bg-[#F4F1EA]'}`}>{l}</button>)}
        </div>
        {ownerView && <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Salesperson" className={`${selectCls} w-48`}><option value="">All salespeople</option>{salespeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (<>
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[[RouteIcon, 'Distance travelled', `${num(data.totals.km)} km`, `${fmtDate(data.range.from)} to ${fmtDate(data.range.to)}`], [Users, 'Days on the road', num(data.totals.days), 'Days with at least one visit'], [MapPin, 'Schools visited', num(data.totals.stops), 'Visits, meetings and demos'], [Navigation, 'Distances missing', num(data.totals.unknown_legs), data.totals.unknown_legs ? 'Add a map pin or type the km' : 'Every leg has a distance']].map(([Icon, label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-[#E2DDD1] bg-white px-5 py-4"><div className="flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">{label}</p><Icon className="h-[18px] w-[18px] text-[#3F3A8C]" /></div><p style={serif} className="mt-1.5 text-[28px] font-medium leading-none text-[#1F2433]">{value}</p><p className="mt-2 text-[12.5px] text-[#6B7080]">{hint}</p></div>
          ))}
        </div>
        <p className="mb-4 rounded-xl bg-[#FAF8F3] px-4 py-3 text-[13px] leading-5 text-[#5B6070]">The distance between two schools is worked out in a straight line from their map pins, so the real road distance is usually a little longer. If you know the real distance, click it and type it. A typed distance always wins.</p>
        {data.days.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No school visits in this period. When you log a visit, the day's route appears here.</Empty></div> : (
          <div className="space-y-5">{data.days.map((day) => <DayCard key={`${day.date}${day.owner_id}`} day={day} ownerView={ownerView} onSave={save} />)}</div>
        )}
      </>)}
    </div>
  );
};

