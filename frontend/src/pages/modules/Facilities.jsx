import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, Avatar, ProgressBar } from '../../components/Shared';
import { VISITORS } from '../../mock2';
import api from '../../api';
import {
  AlertTriangle, BellRing, Bus, CheckCircle2, ClipboardCheck, Clock, Download,
  LogIn, LogOut, MapPin, Navigation, Pencil, Radio,
  RefreshCw, Route, Save, Send, ShieldCheck, Smartphone, UserCheck, Users,
} from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

const emptyRoute = {
  route_name: '', bus_number: '', driver_name: '', driver_mobile: '', attendant_name: '',
  attendant_mobile: '', vehicle_capacity: '40', status: 'Active', class_name: '', section: '',
  stopsText: '', insurance_expiry: '', fitness_expiry: '', permit_expiry: '',
  gps_enabled: true, cctv_enabled: true, first_aid_enabled: true,
};

const emptyTrip = {
  route_id: '', journey: 'Morning pickup', status: 'Boarding', current_stop: '',
  next_stop: '', eta_minutes: '10', delay_message: '',
};

const inputClass = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-medium text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50';
const areaClass = `${inputClass} h-28 resize-none py-3 leading-5`;
const Field = ({ label, children }) => <label className="block"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>{children}</label>;
const transportTone = (status = '') => {
  const value = String(status).toLowerCase();
  if (value.includes('active') || value.includes('route') || value.includes('complete')) return 'green';
  if (value.includes('delay') || value.includes('expired') || value.includes('critical')) return 'red';
  if (value.includes('boarding') || value.includes('review')) return 'blue';
  if (value.includes('due') || value.includes('maintenance')) return 'amber';
  return 'gray';
};
const dateRisk = (value) => {
  if (!value) return { label: 'Not recorded', color: 'gray' };
  const days = Math.ceil((new Date(value) - new Date()) / 86400000);
  if (days < 0) return { label: 'Expired', color: 'red' };
  if (days <= 30) return { label: `Due in ${days} days`, color: 'amber' };
  return { label: 'Valid', color: 'green' };
};

export const Transport = ({ mode = 'overview' }) => {
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [routeForm, setRouteForm] = useState(emptyRoute);
  const [tripForm, setTripForm] = useState(emptyTrip);
  const [assignment, setAssignment] = useState({ route_id: '', class_name: '', section: '', selected: [], stops: {} });
  const [approval, setApproval] = useState({ route_id: '', title: '', priority: 'High risk', reason: '', institutional_impact: '', approval_required: '', decision_due: '' });
  const [approvalFiles, setApprovalFiles] = useState([]);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [routeRes, tripRes, studentRes] = await Promise.all([
        api.get('/parent-center/transport/routes'), api.get('/parent-center/transport/trips'), api.get('/students'),
      ]);
      setRoutes(routeRes.data || []);
      setTrips(tripRes.data || []);
      setStudents(studentRes.data || []);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.detail || 'Transport records could not be loaded. Please check that the backend is running.' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const classes = useMemo(() => [...new Set(students.map((s) => s.class_name).filter(Boolean))].sort(), [students]);
  const sections = useMemo(() => [...new Set(students.filter((s) => !assignment.class_name || s.class_name === assignment.class_name).map((s) => s.section).filter(Boolean))].sort(), [students, assignment.class_name]);
  const latestTripFor = (routeId) => trips.find((trip) => trip.route_id === routeId);
  const activeTrips = trips.filter((trip) => !['Completed', 'Cancelled'].includes(trip.status));
  const linkedStudentIds = new Set(routes.flatMap((route) => route.student_ids || []));
  const capacity = routes.reduce((sum, route) => sum + Number(route.vehicle_capacity || 0), 0);
  const safetyIssues = routes.reduce((count, route) => count + ['insurance_expiry', 'fitness_expiry', 'permit_expiry'].filter((key) => ['red', 'amber'].includes(dateRisk(route[key]).color)).length, 0);

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
      setRouteForm(emptyRoute);
      setNotice({ type: 'success', text: 'Route saved. It is now available to the Parent App and live-journey screen.' });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.detail || 'Route could not be saved.' }); }
    finally { setSaving(false); }
  };

  const editRoute = (routeItem) => setRouteForm({
    ...emptyRoute, ...routeItem,
    stopsText: (routeItem.stops || []).map((stop) => `${stop.name}${stop.time ? ` | ${stop.time}` : ''}`).join('\n'),
  });

  const chooseAssignmentRoute = (routeId) => {
    const routeItem = routes.find((item) => item.id === routeId);
    setAssignment({ route_id: routeId, class_name: routeItem?.class_name || '', section: routeItem?.section || '', selected: routeItem?.student_ids || [], stops: routeItem?.student_stops || {} });
  };
  const visibleStudents = students.filter((student) => (!assignment.class_name || student.class_name === assignment.class_name) && (!assignment.section || student.section === assignment.section) && (!q || `${student.name} ${student.admission_no || student.id}`.toLowerCase().includes(q.toLowerCase())));
  const saveAssignments = async () => {
    const routeItem = routes.find((item) => item.id === assignment.route_id);
    if (!routeItem) return setNotice({ type: 'error', text: 'Choose a route before assigning students.' });
    setSaving(true);
    try {
      await api.post('/parent-center/transport/routes', { ...routeItem, class_name: assignment.class_name, section: assignment.section, student_ids: assignment.selected, student_stops: assignment.stops });
      setNotice({ type: 'success', text: `${assignment.selected.length} students linked. Their parents can now see this route and live journey.` });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.detail || 'Student assignments could not be saved.' }); }
    finally { setSaving(false); }
  };

  const saveTrip = async (event) => {
    event.preventDefault();
    if (!tripForm.route_id) return setNotice({ type: 'error', text: 'Choose a route.' });
    setSaving(true);
    try {
      await api.post('/parent-center/transport/trips', tripForm);
      setNotice({ type: 'success', text: 'Live journey updated. Parents assigned to this route will see the new stop and ETA.' });
      setTripForm({ ...emptyTrip, route_id: tripForm.route_id });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.detail || 'Live journey could not be updated.' }); }
    finally { setSaving(false); }
  };

  const submitDirectorApproval = async (event) => {
    event.preventDefault();
    const routeItem = routes.find((item) => item.id === approval.route_id);
    if (!routeItem || !approvalFiles.length) return setNotice({ type: 'error', text: 'Choose a route and attach at least one supporting document.' });
    const form = new FormData();
    form.append('title', approval.title);
    form.append('summary', `${approval.title} for ${routeItem.route_name} (${routeItem.bus_number || 'vehicle pending'}).`);
    form.append('approval_type', 'Transport safety / compliance');
    form.append('priority', approval.priority);
    form.append('reason', approval.reason);
    form.append('institutional_impact', approval.institutional_impact);
    form.append('approval_required', approval.approval_required);
    form.append('requested_by', 'Transport Administrator');
    form.append('decision_due', approval.decision_due);
    form.append('channels', JSON.stringify(['Director App']));
    approvalFiles.forEach((file) => form.append('supporting_documents', file));
    setSaving(true);
    try {
      await api.post('/notifications/director-approval', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNotice({ type: 'success', text: 'Approval sent to the Director App with the route context and supporting documents.' });
      setApproval({ route_id: '', title: '', priority: 'High risk', reason: '', institutional_impact: '', approval_required: '', decision_due: '' });
      setApprovalFiles([]);
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.detail || 'Director approval could not be sent.' }); }
    finally { setSaving(false); }
  };

  const pageMeta = {
    overview: ['Transport Command Center', 'A live operational view shared across Admin, Parent App and Director App.'],
    routes: ['Routes, Vehicles & Stops', 'Build the bus route once, then keep the crew, stops and compliance record current.'],
    assignments: ['Student Transport Assignments', 'Link real students and pickup stops so each parent sees only the correct route.'],
    live: ['Live Transport Operations', 'Publish boarding, route, delay and arrival updates directly to affected parents.'],
    safety: ['Safety & Director Approvals', 'Monitor statutory readiness and escalate high-impact transport decisions securely.'],
  }[mode] || ['Transport Command Center', 'Manage the complete school transport operation.'];

  const renderOverview = () => (
    <>
      <StatCards items={[
        { label: 'Active Routes', value: routes.filter((r) => r.status === 'Active').length, icon: Route },
        { label: 'Live Journeys', value: activeTrips.length, icon: Radio, tint: 'bg-emerald-50 text-emerald-700' },
        { label: 'Students Linked', value: linkedStudentIds.size, icon: Users, tint: 'bg-blue-50 text-blue-700' },
        { label: 'Safety Actions', value: safetyIssues, icon: ShieldCheck, tint: safetyIssues ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700' },
      ]} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Live route board" subtitle="Updates here are visible in the Parent App." className="xl:col-span-2" pad="p-0">
          {routes.length === 0 ? <EmptyTransport icon={Bus} title="No routes created" copy="Create the first route, stops and vehicle to start transport operations." /> : <div className="divide-y divide-slate-100">{routes.map((routeItem) => { const trip = latestTripFor(routeItem.id); return <div key={routeItem.id} className="flex flex-wrap items-center gap-4 px-6 py-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-[#4F46E5]"><Bus className="h-5 w-5" /></span><div className="min-w-[180px] flex-1"><div className="flex items-center gap-2"><p className="text-[13px] font-bold text-slate-900">{routeItem.route_name}</p><Badge color={transportTone(trip?.status || routeItem.status)}>{trip?.status || routeItem.status}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{routeItem.bus_number || 'Vehicle pending'} · {routeItem.driver_name || 'Driver pending'} · {(routeItem.student_ids || []).length} students</p></div><div className="min-w-[210px] rounded-2xl bg-slate-900 px-4 py-3 text-white"><p className="text-[9px] font-bold uppercase tracking-wider text-white/40">{trip ? 'Live position' : 'Journey status'}</p><p className="mt-1 text-[11px] font-semibold">{trip?.current_stop || 'No active journey'}</p>{trip && <p className="mt-1 text-[9px] text-emerald-300">Next {trip.next_stop || 'stop pending'} · {trip.eta_minutes || 0} min</p>}</div></div>; })}</div>}
        </Card>
        <div className="space-y-5">
          <Card title="Parent App sync" subtitle="What families receive"><div className="space-y-3">{[['Assigned bus & crew', Bus], ['Pickup stop & timing', MapPin], ['Live stop and ETA', Navigation], ['Delay and arrival updates', BellRing]].map(([label, Icon]) => <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Icon className="h-4 w-4 text-[#4F46E5]" /><span className="text-[11px] font-semibold text-slate-700">{label}</span><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" /></div>)}</div></Card>
          <Card title="Fleet utilisation" subtitle={`${linkedStudentIds.size} linked students across ${capacity || 0} seats`}><ProgressBar value={capacity ? Math.min(100, Math.round(linkedStudentIds.size / capacity * 100)) : 0} /><p className="mt-3 text-[10px] text-slate-500">{capacity ? `${Math.round(linkedStudentIds.size / capacity * 100)}% of recorded capacity allocated` : 'Add vehicle capacity to see utilisation.'}</p></Card>
        </div>
      </div>
    </>
  );

  const renderRoutes = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <Card title={routeForm.id ? 'Edit route' : 'Create route'} subtitle="Vehicle, crew, ordered stops and statutory readiness." className="xl:col-span-2 self-start">
        <form onSubmit={saveRoute} className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field label="Route name"><input required className={inputClass} value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })} placeholder="Route 01 · Lake View" /></Field><Field label="Bus number"><input className={inputClass} value={routeForm.bus_number} onChange={(e) => setRouteForm({ ...routeForm, bus_number: e.target.value })} placeholder="TS 09 AB 2042" /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Driver"><input className={inputClass} value={routeForm.driver_name} onChange={(e) => setRouteForm({ ...routeForm, driver_name: e.target.value })} /></Field><Field label="Driver mobile"><input className={inputClass} value={routeForm.driver_mobile} onChange={(e) => setRouteForm({ ...routeForm, driver_mobile: e.target.value })} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Attendant"><input className={inputClass} value={routeForm.attendant_name} onChange={(e) => setRouteForm({ ...routeForm, attendant_name: e.target.value })} /></Field><Field label="Capacity"><input type="number" min="1" className={inputClass} value={routeForm.vehicle_capacity} onChange={(e) => setRouteForm({ ...routeForm, vehicle_capacity: e.target.value })} /></Field></div><Field label="Stops — one per line: stop name | time"><textarea required className={areaClass} value={routeForm.stopsText} onChange={(e) => setRouteForm({ ...routeForm, stopsText: e.target.value })} placeholder={'School Campus | 06:50\nLake View Road | 07:15'} /></Field><div className="grid grid-cols-3 gap-3"><Field label="Insurance expiry"><input type="date" className={inputClass} value={routeForm.insurance_expiry} onChange={(e) => setRouteForm({ ...routeForm, insurance_expiry: e.target.value })} /></Field><Field label="Fitness expiry"><input type="date" className={inputClass} value={routeForm.fitness_expiry} onChange={(e) => setRouteForm({ ...routeForm, fitness_expiry: e.target.value })} /></Field><Field label="Permit expiry"><input type="date" className={inputClass} value={routeForm.permit_expiry} onChange={(e) => setRouteForm({ ...routeForm, permit_expiry: e.target.value })} /></Field></div><div className="grid grid-cols-3 gap-2">{[['GPS', 'gps_enabled'], ['CCTV', 'cctv_enabled'], ['First aid', 'first_aid_enabled']].map(([label, key]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={routeForm[key]} onChange={(e) => setRouteForm({ ...routeForm, [key]: e.target.checked })} className="accent-[#4F46E5]" />{label}</label>)}</div><div className="flex gap-3"><Btn type="submit" icon={Save} disabled={saving} className="flex-1">{routeForm.id ? 'Update route' : 'Save route'}</Btn>{routeForm.id && <Btn variant="outline" onClick={() => setRouteForm(emptyRoute)}>Cancel</Btn>}</div></form>
      </Card>
      <Card title="Route directory" subtitle="Every active route used by the Parent App." className="xl:col-span-3" pad="p-0">{routes.length === 0 ? <EmptyTransport icon={Route} title="No routes yet" copy="Create the first transport route." /> : <div className="divide-y divide-slate-100">{routes.map((routeItem) => <div key={routeItem.id} className="p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]"><Route className="h-4 w-4" /></span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-bold text-slate-900">{routeItem.route_name}</p><Badge color={transportTone(routeItem.status)}>{routeItem.status}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{routeItem.bus_number || 'Bus pending'} · {routeItem.driver_name || 'Driver pending'} · {(routeItem.stops || []).length} stops · {(routeItem.student_ids || []).length} students</p><div className="mt-3 flex flex-wrap gap-2">{(routeItem.stops || []).map((stop, index) => <span key={`${stop.name}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-600">{index + 1}. {stop.name} {stop.time && `· ${stop.time}`}</span>)}</div></div><Btn variant="outline" icon={Pencil} onClick={() => editRoute(routeItem)}>Edit</Btn></div></div>)}</div>}</Card>
    </div>
  );

  const renderAssignments = () => {
    const selectedRoute = routes.find((item) => item.id === assignment.route_id);
    return <><Card title="Choose route and student group" subtitle="Only real enrolled students are available for assignment."><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><Field label="Route"><select className={inputClass} value={assignment.route_id} onChange={(e) => chooseAssignmentRoute(e.target.value)}><option value="">Select route</option>{routes.map((routeItem) => <option key={routeItem.id} value={routeItem.id}>{routeItem.route_name}</option>)}</select></Field><Field label="Class"><select className={inputClass} value={assignment.class_name} onChange={(e) => setAssignment({ ...assignment, class_name: e.target.value, section: '' })}><option value="">All classes</option>{classes.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Section"><select className={inputClass} value={assignment.section} onChange={(e) => setAssignment({ ...assignment, section: e.target.value })}><option value="">All sections</option>{sections.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Search"><SearchBar value={q} onChange={(e) => setQ(e.target.value)} placeholder="Student or admission no." className="w-full" /></Field></div></Card><Card title="Assign students and pickup stops" subtitle={selectedRoute ? `${selectedRoute.route_name} · ${assignment.selected.length} selected` : 'Choose a route to begin'} action={<Btn icon={Save} onClick={saveAssignments} disabled={saving || !selectedRoute}>Save assignments</Btn>} pad="p-0">{!selectedRoute ? <EmptyTransport icon={Users} title="Select a route" copy="The student list will open after a transport route is selected." /> : visibleStudents.length === 0 ? <EmptyTransport icon={Users} title="No students in this group" copy="Choose another class or section." /> : <div className="overflow-x-auto"><Table columns={[{ label: 'Assign' }, { label: 'Student' }, { label: 'Class / Section' }, { label: 'Pickup stop' }, { label: 'Parent App' }]}>{visibleStudents.map((student) => { const checked = assignment.selected.includes(student.id); return <tr key={student.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><input type="checkbox" checked={checked} onChange={(e) => setAssignment({ ...assignment, selected: e.target.checked ? [...assignment.selected, student.id] : assignment.selected.filter((id) => id !== student.id) })} className="h-4 w-4 accent-[#4F46E5]" /></td><td className="py-4"><p className="text-[12px] font-bold text-slate-800">{student.name}</p><p className="text-[9px] text-slate-400">{student.admission_no || student.id}</p></td><td className="py-4 text-[11px] text-slate-500">{student.class_name} · {student.section}</td><td className="py-4"><select disabled={!checked} className={`${inputClass} max-w-[220px] disabled:bg-slate-50 disabled:text-slate-300`} value={assignment.stops[student.id] || ''} onChange={(e) => setAssignment({ ...assignment, stops: { ...assignment.stops, [student.id]: e.target.value } })}><option value="">Choose pickup stop</option>{(selectedRoute.stops || []).map((stop) => <option key={stop.name} value={stop.name}>{stop.name} {stop.time && `· ${stop.time}`}</option>)}</select></td><td className="py-4 pr-6"><Badge color={checked ? 'green' : 'gray'}>{checked ? 'Will sync' : 'Not linked'}</Badge></td></tr>; })}</Table></div>}</Card></>;
  };

  const renderLive = () => {
    const routeItem = routes.find((item) => item.id === tripForm.route_id);
    return <div className="grid grid-cols-1 gap-5 xl:grid-cols-5"><Card title="Publish journey update" subtitle="Affected parents receive the updated status, stop and ETA." className="xl:col-span-2 self-start"><form onSubmit={saveTrip} className="space-y-4"><Field label="Route"><select required className={inputClass} value={tripForm.route_id} onChange={(e) => setTripForm({ ...tripForm, route_id: e.target.value })}><option value="">Select route</option>{routes.map((item) => <option key={item.id} value={item.id}>{item.route_name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Journey"><select className={inputClass} value={tripForm.journey} onChange={(e) => setTripForm({ ...tripForm, journey: e.target.value })}><option>Morning pickup</option><option>Evening drop</option></select></Field><Field label="Status"><select className={inputClass} value={tripForm.status} onChange={(e) => setTripForm({ ...tripForm, status: e.target.value })}>{['Boarding', 'On Route', 'Delayed', 'Arrived at School', 'Completed'].map((item) => <option key={item}>{item}</option>)}</select></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Current stop"><select className={inputClass} value={tripForm.current_stop} onChange={(e) => setTripForm({ ...tripForm, current_stop: e.target.value })}><option value="">Select stop</option>{(routeItem?.stops || []).map((stop) => <option key={stop.name}>{stop.name}</option>)}</select></Field><Field label="Next stop"><select className={inputClass} value={tripForm.next_stop} onChange={(e) => setTripForm({ ...tripForm, next_stop: e.target.value })}><option value="">Select stop</option>{(routeItem?.stops || []).map((stop) => <option key={stop.name}>{stop.name}</option>)}</select></Field></div><Field label="ETA in minutes"><input type="number" min="0" className={inputClass} value={tripForm.eta_minutes} onChange={(e) => setTripForm({ ...tripForm, eta_minutes: e.target.value })} /></Field>{tripForm.status === 'Delayed' && <Field label="Delay message for parents"><textarea className={areaClass} value={tripForm.delay_message} onChange={(e) => setTripForm({ ...tripForm, delay_message: e.target.value })} placeholder="Traffic near Jubilee Hills. Revised arrival 08:15 AM." /></Field>}<Btn type="submit" icon={Smartphone} className="w-full" disabled={saving}>Publish to Parent App</Btn></form></Card><Card title="Live journey board" subtitle="Current operational status across all routes." className="xl:col-span-3" pad="p-0">{activeTrips.length === 0 ? <EmptyTransport icon={Radio} title="No journey is live" copy="Start a morning pickup or evening drop update." /> : <div className="divide-y divide-slate-100">{activeTrips.map((trip) => <div key={trip.id} className="p-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Navigation className="h-5 w-5" /></span><div className="flex-1"><div className="flex items-center gap-2"><p className="text-[13px] font-bold text-slate-900">{trip.route_name}</p><Badge color={transportTone(trip.status)}>{trip.status}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{trip.journey} · Updated {new Date(trip.updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div><p className="text-right text-[22px] font-bold text-slate-900">{trip.eta_minutes || 0}<span className="ml-1 text-[9px] font-medium text-slate-400">MIN</span></p></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Current</p><p className="mt-1 text-[11px] font-semibold text-slate-700">{trip.current_stop || '—'}</p></div><div className="rounded-xl bg-indigo-50 p-3"><p className="text-[9px] font-bold uppercase text-indigo-400">Next</p><p className="mt-1 text-[11px] font-semibold text-indigo-700">{trip.next_stop || '—'}</p></div></div></div>)}</div>}</Card></div>;
  };

  const renderSafety = () => (
    <div className="space-y-5"><Card title="Fleet compliance board" subtitle="Amber and red records should be resolved before the vehicle is dispatched." pad="p-0">{routes.length === 0 ? <EmptyTransport icon={ShieldCheck} title="No fleet records" copy="Create routes and enter vehicle compliance dates." /> : <div className="overflow-x-auto"><Table columns={[{ label: 'Route / Vehicle' }, { label: 'Insurance' }, { label: 'Fitness' }, { label: 'Permit' }, { label: 'Safety equipment' }, { label: 'Readiness' }]}>{routes.map((routeItem) => { const checks = [dateRisk(routeItem.insurance_expiry), dateRisk(routeItem.fitness_expiry), dateRisk(routeItem.permit_expiry)]; const issue = checks.some((item) => item.color === 'red') ? 'Dispatch blocked' : checks.some((item) => item.color === 'amber') ? 'Review required' : 'Ready'; return <tr key={routeItem.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><p className="text-[12px] font-bold text-slate-800">{routeItem.route_name}</p><p className="text-[9px] text-slate-400">{routeItem.bus_number || 'Vehicle pending'}</p></td>{['insurance_expiry', 'fitness_expiry', 'permit_expiry'].map((key) => { const risk = dateRisk(routeItem[key]); return <td key={key} className="py-4"><Badge color={risk.color}>{risk.label}</Badge><p className="mt-1 text-[9px] text-slate-400">{routeItem[key] || 'Date missing'}</p></td>; })}<td className="py-4 text-[10px] text-slate-500">{[routeItem.gps_enabled && 'GPS', routeItem.cctv_enabled && 'CCTV', routeItem.first_aid_enabled && 'First aid'].filter(Boolean).join(' · ') || 'Not recorded'}</td><td className="py-4 pr-6"><Badge color={issue === 'Ready' ? 'green' : issue.includes('blocked') ? 'red' : 'amber'}>{issue}</Badge></td></tr>; })}</Table></div>}</Card><div className="grid grid-cols-1 gap-5 xl:grid-cols-5"><Card title="Send decision to Director App" subtitle="Use this only for safety, compliance, replacement, vendor or high-impact route decisions." className="xl:col-span-3"><form onSubmit={submitDirectorApproval} className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field label="Route"><select required className={inputClass} value={approval.route_id} onChange={(e) => setApproval({ ...approval, route_id: e.target.value })}><option value="">Choose affected route</option>{routes.map((item) => <option key={item.id} value={item.id}>{item.route_name} · {item.bus_number || 'No vehicle'}</option>)}</select></Field><Field label="Priority"><select className={inputClass} value={approval.priority} onChange={(e) => setApproval({ ...approval, priority: e.target.value })}><option>High risk</option><option>Urgent</option><option>Standard</option></select></Field></div><Field label="Decision title"><input required className={inputClass} value={approval.title} onChange={(e) => setApproval({ ...approval, title: e.target.value })} placeholder="Approve replacement bus for Route 04" /></Field><Field label="Reason"><textarea required className={areaClass} value={approval.reason} onChange={(e) => setApproval({ ...approval, reason: e.target.value })} placeholder="Why this decision is being requested." /></Field><Field label="Institutional impact"><textarea required className={areaClass} value={approval.institutional_impact} onChange={(e) => setApproval({ ...approval, institutional_impact: e.target.value })} placeholder="Students, routes, safety, cost and continuity affected." /></Field><Field label="What approval is required"><input required className={inputClass} value={approval.approval_required} onChange={(e) => setApproval({ ...approval, approval_required: e.target.value })} placeholder="Approve vendor quotation and temporary vehicle" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Decision due"><input required type="datetime-local" className={inputClass} value={approval.decision_due} onChange={(e) => setApproval({ ...approval, decision_due: e.target.value })} /></Field><Field label="Supporting documents"><input required type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className={`${inputClass} pt-2`} onChange={(e) => setApprovalFiles([...e.target.files])} /></Field></div><Btn type="submit" icon={Send} disabled={saving} className="w-full">Send secure approval to Director</Btn></form></Card><div className="space-y-5 xl:col-span-2"><Card title="Director receives" subtitle="A complete decision pack, not a general notification"><div className="space-y-3">{['Decision title and priority', 'Reason and institutional impact', 'Exact approval required', 'Supporting documents', 'Decision deadline and requestor'].map((label) => <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><ClipboardCheck className="h-4 w-4 text-[#4F46E5]" /><span className="text-[10px] font-semibold text-slate-700">{label}</span></div>)}</div></Card><Card title="Operational rule" subtitle="Keep parent communication separate"><p className="text-[11px] leading-6 text-slate-500">Live location, ETA, boarding, delay and arrival belong to the Parent App. Vehicle replacement, safety exceptions and high-impact expenditure belong to secure Director approval.</p></Card></div></div></div>
  );

  return (
    <Layout>
      <PageTitle title={pageMeta[0]} subtitle={pageMeta[1]} actions={<Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn>} />
      {notice && <div className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[11px] font-semibold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-indigo-100 bg-indigo-50 text-[#4338CA]'}`}>{notice.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.text}<button onClick={() => setNotice(null)} className="ml-auto text-current">×</button></div>}
      {loading ? <Card><EmptyTransport icon={RefreshCw} title="Loading transport operations" copy="Connecting routes, students and live trips…" /></Card> : <>{mode === 'overview' && renderOverview()}{mode === 'routes' && renderRoutes()}{mode === 'assignments' && renderAssignments()}{mode === 'live' && renderLive()}{mode === 'safety' && renderSafety()}</>}
    </Layout>
  );
};

const EmptyTransport = ({ icon: Icon, title, copy }) => <div className="flex flex-col items-center justify-center px-6 py-16 text-center"><span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="h-6 w-6" /></span><p className="text-[14px] font-bold text-slate-800">{title}</p><p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-400">{copy}</p></div>;

export const VisitorManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(VISITORS, q, ['name', 'purpose', 'host', 'status']);
  const exportCSV = () => downloadCSV('visitors.csv', ['Visitor', 'Purpose', 'Host', 'In', 'Out', 'Status'], rows.map((v) => [v.name, v.purpose, v.host, v.in, v.out, v.status]));
  return (
    <Layout>
      <PageTitle title="Visitor Management" subtitle="Track and log campus visitors in real time."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={UserCheck}>Register Visitor</Btn></>} />
      <StatCards items={[
        { label: 'Total Today', value: '38', icon: Users },
        { label: 'Checked In', value: '31', icon: LogIn, tint: 'bg-green-50 text-green-600' },
        { label: 'Currently Inside', value: '7', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Checked Out', value: '31', icon: LogOut, tint: 'bg-blue-50 text-blue-600' },
      ]} />
      <Card title="Visitor Log" action={<SearchBar placeholder="Search visitors..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Visitor'},{label:'Purpose'},{label:'Host'},{label:'Check-In'},{label:'Check-Out'},{label:'Status'}]}>
          {rows.map((v, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={v.avatar} alt={v.name} size={8} /><span className="text-[13px] font-medium text-[#333]">{v.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{v.purpose}</td>
              <td className="py-3 text-[13px] text-[#666]">{v.host}</td>
              <td className="py-3 text-[13px] text-[#666]">{v.in}</td>
              <td className="py-3 text-[13px] text-[#666]">{v.out}</td>
              <td className="py-3"><Badge color={v.status==='Inside'?'amber':'green'}>{v.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No visitors found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
