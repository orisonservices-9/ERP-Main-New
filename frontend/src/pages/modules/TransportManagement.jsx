import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, ProgressBar } from '../../components/Shared';
import api from '../../api';
import { AlertTriangle, Bus, CheckCircle2, FileCheck2, MapPin, Navigation, Pencil, Phone, Radio, RefreshCw, Route, Save, Satellite, ShieldCheck, Users } from 'lucide-react';

const blankRoute = {
  route_name: '', bus_number: '', driver_name: '', driver_mobile: '', attendant_name: '',
  attendant_mobile: '', vehicle_capacity: '40', status: 'Active', stopsText: '',
  tracker_provider: '', tracker_device_id: '', vehicle_type: 'School Bus',
  insurance_expiry: '', fitness_expiry: '', permit_expiry: '',
};

const inputClass = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-medium text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50';
const areaClass = `${inputClass} h-28 resize-none py-3 leading-5`;
const Field = ({ label, children }) => <label className="block"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>{children}</label>;
const Empty = ({ icon: Icon, title, copy }) => <div className="flex flex-col items-center justify-center px-6 py-16 text-center"><span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="h-6 w-6" /></span><p className="text-[14px] font-bold text-slate-800">{title}</p><p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-400">{copy}</p></div>;

const isLive = (trip) => trip && !['Completed', 'Cancelled'].includes(trip.status);
const formatSync = (value) => {
  if (!value) return 'Waiting for tracker data';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tracker data received' : `Synced ${date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
};

export const Transport = ({ mode = 'overview' }) => {
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [students, setStudents] = useState([]);
  const [routeForm, setRouteForm] = useState(blankRoute);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [routeRes, tripRes, studentRes] = await Promise.all([
        api.get('/parent-center/transport/routes'),
        api.get('/parent-center/transport/trips'),
        api.get('/students'),
      ]);
      setRoutes(routeRes.data || []);
      setTrips(tripRes.data || []);
      setStudents(studentRes.data || []);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.detail || 'Transport records could not be loaded.' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const studentsForRoute = (routeItem) => students.filter((student) =>
    (routeItem.student_ids || []).includes(student.id)
    || student.transport_route_id === routeItem.id
    || student.transport_route === routeItem.id
    || student.transport_route === routeItem.route_name
  );
  const latestTripFor = (routeId) => trips.find((trip) => trip.route_id === routeId);
  const activeTrips = trips.filter(isLive);
  const linkedStudentIds = new Set(routes.flatMap((routeItem) => studentsForRoute(routeItem).map((student) => student.id)));
  const capacity = routes.reduce((sum, routeItem) => sum + Number(routeItem.vehicle_capacity || 0), 0);
  const trackerRoutes = routes.filter((routeItem) => routeItem.tracker_device_id);
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = (value) => Boolean(value && value < today);
  const routeReadiness = (routeItem) => {
    const checks = [routeItem.bus_number, routeItem.driver_name, routeItem.driver_mobile, routeItem.attendant_name, routeItem.attendant_mobile, (routeItem.stops || []).length];
    const documentsValid = [routeItem.insurance_expiry, routeItem.fitness_expiry, routeItem.permit_expiry].every((value) => value && !isExpired(value));
    return { ready: checks.every(Boolean) && documentsValid, documentsValid };
  };
  const readyRoutes = routes.filter((routeItem) => routeReadiness(routeItem).ready).length;
  const overloadedRoutes = routes.filter((routeItem) => studentsForRoute(routeItem).length > Number(routeItem.vehicle_capacity || 0)).length;

  const saveRoute = async (event) => {
    event.preventDefault();
    const stops = routeForm.stopsText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, time = ''] = line.split('|').map((part) => part.trim());
      return { name, time };
    });
    if (!routeForm.route_name.trim() || !stops.length) return setNotice({ type: 'error', text: 'Enter a route name and at least one stop.' });
    setSaving(true);
    try {
      const payload = { ...routeForm, stops };
      delete payload.stopsText;
      await api.post('/parent-center/transport/routes', payload);
      setRouteForm(blankRoute);
      setNotice({ type: 'success', text: 'Route saved. The tracker device can now send live location automatically.' });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.detail || 'Route could not be saved.' });
    } finally { setSaving(false); }
  };

  const editRoute = (routeItem) => setRouteForm({
    ...blankRoute, ...routeItem,
    stopsText: (routeItem.stops || []).map((stop) => `${stop.name}${stop.time ? ` | ${stop.time}` : ''}`).join('\n'),
  });

  const renderOverview = () => (
    <>
      <div className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-7 text-white shadow-xl shadow-indigo-100 md:p-9"><div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"><Bus className="h-3.5 w-3.5" /> Transport command centre</span><h2 className="mt-5 font-poppins text-3xl font-bold md:text-4xl">Safe journeys start before the bus moves.</h2><p className="mt-3 max-w-xl text-[13px] leading-6 text-blue-100/70">See route readiness, vehicle capacity, crew contacts and live GPS movement from real school transport records.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[610px]">{[[Route, 'Active routes', routes.filter((item) => item.status === 'Active').length], [ShieldCheck, 'Ready to operate', readyRoutes], [Radio, 'Buses on trip', activeTrips.length], [AlertTriangle, 'Over capacity', overloadedRoutes]].map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><Icon className="h-4 w-4 text-blue-200" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-[10px] text-blue-100/60">{label}</p></div>)}</div></div></div>
      <StatCards items={[
        { label: 'Active Routes', value: routes.filter((routeItem) => routeItem.status === 'Active').length, icon: Route },
        { label: 'GPS Connected', value: trackerRoutes.length, icon: Satellite, tint: 'bg-emerald-50 text-emerald-700' },
        { label: 'Buses On Trip', value: activeTrips.length, icon: Radio, tint: 'bg-blue-50 text-blue-700' },
        { label: 'Students Using Bus', value: linkedStudentIds.size, icon: Users, tint: 'bg-violet-50 text-violet-700' },
      ]} />
      <Card title="Daily transport readiness" subtitle="Only routes with complete crew, stops and valid vehicle documents are marked ready." pad="p-0" className="mb-5">
        {!routes.length ? <Empty icon={ShieldCheck} title="No readiness records" copy="Create a route to begin transport safety checks." /> : <div className="grid grid-cols-1 gap-px bg-slate-100 lg:grid-cols-2">{routes.map((routeItem) => { const assigned = studentsForRoute(routeItem).length; const seats = Number(routeItem.vehicle_capacity || 0); const readiness = routeReadiness(routeItem); return <div key={routeItem.id} className="bg-white p-5"><div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${readiness.ready ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{readiness.ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-bold text-slate-900">{routeItem.route_name}</p><Badge color={readiness.ready ? 'green' : 'amber'}>{readiness.ready ? 'Ready' : 'Action needed'}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{routeItem.bus_number || 'Vehicle missing'} · {routeItem.driver_name || 'Driver missing'}</p></div><p className={`text-[11px] font-bold ${assigned > seats ? 'text-red-600' : 'text-slate-700'}`}>{assigned}/{seats || 0} seats</p></div><div className="mt-4 grid grid-cols-3 gap-2">{[['Crew', routeItem.driver_mobile && routeItem.attendant_mobile], ['Documents', readiness.documentsValid], ['GPS', routeItem.tracker_device_id]].map(([label, ok]) => <div key={label} className={`rounded-xl px-3 py-2 text-center text-[9px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{label} · {ok ? 'Ready' : 'Pending'}</div>)}</div></div>; })}</div>}
      </Card>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Automatic GPS feed" subtitle="Read-only live location received from the bus-tracking partner. No manual location entry is required." className="xl:col-span-2" pad="p-0">
          {!routes.length ? <Empty icon={Bus} title="No routes created" copy="Create a route and connect its tracker device to start receiving automatic location updates." /> : <div className="divide-y divide-slate-100">{routes.map((routeItem) => {
            const trip = latestTripFor(routeItem.id);
            const connected = Boolean(routeItem.tracker_device_id);
            return <div key={routeItem.id} className="flex flex-wrap items-center gap-4 px-6 py-5">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}><Bus className="h-5 w-5" /></span>
              <div className="min-w-[190px] flex-1"><div className="flex items-center gap-2"><p className="text-[13px] font-bold text-slate-900">{routeItem.route_name}</p><Badge color={connected ? 'green' : 'gray'}>{connected ? 'GPS connected' : 'Tracker not linked'}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{routeItem.bus_number || 'Vehicle pending'} · {routeItem.tracker_provider || 'Provider pending'} · {studentsForRoute(routeItem).length} students</p></div>
              <div className="min-w-[245px] rounded-2xl bg-slate-900 px-4 py-3 text-white"><p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Latest tracker position</p><p className="mt-1 text-[11px] font-semibold">{trip?.current_stop || (connected ? 'Waiting for first GPS update' : 'Connect a tracker device')}</p>{trip && <p className="mt-1 text-[9px] text-emerald-300">Next {trip.next_stop || 'stop pending'} · ETA {trip.eta_minutes || 0} min</p>}<p className="mt-1 text-[8px] text-white/35">{formatSync(trip?.updated || routeItem.tracker_last_seen)}</p></div>
            </div>;
          })}</div>}
        </Card>
        <div className="space-y-5">
          <Card title="Tracker integration" subtitle="Automatic flow to the Parent App"><div className="space-y-3">{[['Partner GPS device sends location', Satellite], ['Route and bus are matched by device ID', Route], ['ETA is calculated for the next stop', Navigation], ['Parents see the assigned route automatically', MapPin]].map(([label, Icon]) => <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Icon className="h-4 w-4 text-[#4F46E5]" /><span className="text-[10px] font-semibold text-slate-700">{label}</span><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" /></div>)}</div></Card>
          <Card title="Fleet utilisation" subtitle={`${linkedStudentIds.size} students across ${capacity || 0} recorded seats`}><ProgressBar value={capacity ? Math.min(100, Math.round(linkedStudentIds.size / capacity * 100)) : 0} /><p className="mt-3 text-[10px] text-slate-500">Student route and pickup-stop assignments are maintained in Add Student, Bulk Upload and Edit Student.</p></Card>
        </div>
      </div>
    </>
  );

  const renderRoutes = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <Card title={routeForm.id ? 'Edit route' : 'Create route'} subtitle="Set up the vehicle, crew, stops and partner tracker identity." className="xl:col-span-2 self-start">
        <form onSubmit={saveRoute} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Field label="Route name"><input required className={inputClass} value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })} placeholder="Route 01 · Lake View" /></Field><Field label="Bus number"><input className={inputClass} value={routeForm.bus_number} onChange={(e) => setRouteForm({ ...routeForm, bus_number: e.target.value })} placeholder="TS 09 AB 2042" /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Vehicle type"><select className={inputClass} value={routeForm.vehicle_type} onChange={(e) => setRouteForm({ ...routeForm, vehicle_type: e.target.value })}><option>School Bus</option><option>Mini Bus</option><option>Van</option></select></Field><Field label="Route status"><select className={inputClass} value={routeForm.status} onChange={(e) => setRouteForm({ ...routeForm, status: e.target.value })}><option>Active</option><option>Under Maintenance</option><option>Inactive</option></select></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Driver"><input className={inputClass} value={routeForm.driver_name} onChange={(e) => setRouteForm({ ...routeForm, driver_name: e.target.value })} /></Field><Field label="Driver mobile"><input className={inputClass} value={routeForm.driver_mobile} onChange={(e) => setRouteForm({ ...routeForm, driver_mobile: e.target.value })} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Attendant"><input className={inputClass} value={routeForm.attendant_name} onChange={(e) => setRouteForm({ ...routeForm, attendant_name: e.target.value })} /></Field><Field label="Attendant mobile"><input className={inputClass} value={routeForm.attendant_mobile} onChange={(e) => setRouteForm({ ...routeForm, attendant_mobile: e.target.value })} /></Field></div>
          <Field label="Vehicle capacity"><input type="number" min="1" className={inputClass} value={routeForm.vehicle_capacity} onChange={(e) => setRouteForm({ ...routeForm, vehicle_capacity: e.target.value })} /></Field>
          <Field label="Stops — one per line: stop name | time"><textarea required className={areaClass} value={routeForm.stopsText} onChange={(e) => setRouteForm({ ...routeForm, stopsText: e.target.value })} placeholder={'School Campus | 06:50\nLake View Road | 07:15'} /></Field>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"><div className="mb-3 flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-600" /><p className="text-[11px] font-bold text-slate-800">Vehicle document validity</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field label="Insurance expiry"><input type="date" className={inputClass} value={routeForm.insurance_expiry} onChange={(e) => setRouteForm({ ...routeForm, insurance_expiry: e.target.value })} /></Field><Field label="Fitness expiry"><input type="date" className={inputClass} value={routeForm.fitness_expiry} onChange={(e) => setRouteForm({ ...routeForm, fitness_expiry: e.target.value })} /></Field><Field label="Permit expiry"><input type="date" className={inputClass} value={routeForm.permit_expiry} onChange={(e) => setRouteForm({ ...routeForm, permit_expiry: e.target.value })} /></Field></div></div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><div className="mb-3 flex items-center gap-2"><Satellite className="h-4 w-4 text-[#4F46E5]" /><p className="text-[11px] font-bold text-slate-800">GPS partner connection</p></div><div className="grid grid-cols-2 gap-3"><Field label="Tracker provider"><input className={inputClass} value={routeForm.tracker_provider} onChange={(e) => setRouteForm({ ...routeForm, tracker_provider: e.target.value })} placeholder="Provider company" /></Field><Field label="Tracker device ID"><input className={inputClass} value={routeForm.tracker_device_id} onChange={(e) => setRouteForm({ ...routeForm, tracker_device_id: e.target.value })} placeholder="GPS-DEVICE-001" /></Field></div><p className="mt-3 text-[9px] leading-4 text-slate-500">The device ID securely matches the partner feed to this route. Live location is never entered manually.</p></div>
          <div className="flex gap-3"><Btn type="submit" icon={Save} disabled={saving} className="flex-1">{routeForm.id ? 'Update route' : 'Save route'}</Btn>{routeForm.id && <Btn variant="outline" onClick={() => setRouteForm(blankRoute)}>Cancel</Btn>}</div>
        </form>
      </Card>
      <Card title="Route directory" subtitle="Routes, stops and GPS connectivity used by the Parent App." className="xl:col-span-3" pad="p-0">
        {!routes.length ? <Empty icon={Route} title="No routes yet" copy="Create the first transport route." /> : <div className="divide-y divide-slate-100">{routes.map((routeItem) => <div key={routeItem.id} className="p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]"><Route className="h-4 w-4" /></span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-bold text-slate-900">{routeItem.route_name}</p><Badge color={routeItem.status === 'Active' ? 'green' : 'amber'}>{routeItem.status || 'Active'}</Badge><Badge color={routeItem.tracker_device_id ? 'blue' : 'gray'}>{routeItem.tracker_device_id ? 'GPS connected' : 'Tracker pending'}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{routeItem.vehicle_type || 'School Bus'} · {routeItem.bus_number || 'Bus pending'} · {(routeItem.stops || []).length} stops · {studentsForRoute(routeItem).length}/{routeItem.vehicle_capacity || 0} seats</p><div className="mt-2 flex flex-wrap gap-3 text-[9px] text-slate-500"><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{routeItem.driver_name || 'Driver pending'} · {routeItem.driver_mobile || 'mobile pending'}</span><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{routeItem.attendant_name || 'Attendant pending'} · {routeItem.attendant_mobile || 'mobile pending'}</span></div>{routeItem.tracker_device_id && <p className="mt-1 text-[9px] font-medium text-emerald-600">{routeItem.tracker_provider || 'GPS partner'} · Device {routeItem.tracker_device_id}</p>}<div className="mt-3 flex flex-wrap gap-2">{(routeItem.stops || []).map((stop, index) => <span key={`${stop.name}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-600">{index + 1}. {stop.name} {stop.time && `· ${stop.time}`}</span>)}</div></div><Btn variant="outline" icon={Pencil} onClick={() => editRoute(routeItem)}>Edit</Btn></div></div>)}</div>}
      </Card>
    </div>
  );

  const page = mode === 'routes'
    ? ['Routes, Vehicles & Stops', 'Create route records and connect each vehicle to the GPS tracking partner.']
    : ['Transport Overview', 'Monitor routes and the automatic GPS partner feed without manual live-operation updates.'];

  return <Layout><PageTitle title={page[0]} subtitle={page[1]} actions={<Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn>} />{notice && <div className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[11px] font-semibold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-indigo-100 bg-indigo-50 text-[#4338CA]'}`}>{notice.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.text}<button onClick={() => setNotice(null)} className="ml-auto">×</button></div>}{loading ? <Card><Empty icon={RefreshCw} title="Loading transport" copy="Connecting routes and the GPS feed…" /></Card> : mode === 'routes' ? renderRoutes() : renderOverview()}</Layout>;
};

export default Transport;
