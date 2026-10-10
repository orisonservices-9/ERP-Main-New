import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, ChevronDown, Bus, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../api';

const Field = ({ label, value, select }) => (
  <div>
    <label className="block text-[12px] text-[#8a8a8a] mb-1.5">{label}</label>
    <div className="relative">
      <input defaultValue={value} className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-200 transition" />
      {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
    </div>
  </div>
);

const ProfileEditTab = ({ detail }) => {
  const s = detail.student;
  const raw = s.raw || {};
  const [routes, setRoutes] = useState([]);
  const [transport, setTransport] = useState({ transport_route_id: raw.transport_route_id || '', transport_route: raw.transport_route || '', pickup_stop: raw.pickup_stop || '' });
  const [savingTransport, setSavingTransport] = useState(false);
  const [transportSaved, setTransportSaved] = useState(false);
  useEffect(() => { api.get('/parent-center/transport/routes').then(({ data }) => setRoutes((data || []).filter((route) => route.status !== 'Inactive'))).catch(() => setRoutes([])); }, []);
  const selectedRoute = useMemo(() => routes.find((route) => route.id === transport.transport_route_id || route.route_name === transport.transport_route), [routes, transport]);
  const saveTransport = async () => {
    setSavingTransport(true); setTransportSaved(false);
    const route = routes.find((item) => item.id === transport.transport_route_id);
    await api.put(`/students/${s.id}`, { ...raw, id: s.id, name: raw.name || s.name, admission_no: raw.admission_no || s.admission_no || '', transport_route_id: route?.id || '', transport_route: route?.route_name || '', pickup_stop: route ? transport.pickup_stop : '' });
    setSavingTransport(false); setTransportSaved(true);
  };
  const fields = [
    { label: 'Student Name', value: raw.name || s.name },
    { label: 'Admission No', value: raw.admission_no || s.admission_no },
    { label: 'Class', value: raw.class_name, select: true },
    { label: 'Section', value: raw.section, select: true },
    { label: 'Academic Year', value: raw.academic_year || '2024-2025', select: true },
    { label: 'Status', value: raw.status || s.status },
    { label: 'Blood Group', value: raw.blood_group || '—' },
    { label: 'Date of Birth', value: raw.dob || '—' },
    { label: 'Gender', value: raw.gender || '—', select: true },
    { label: 'Aadhar No', value: raw.aadhar || '—' },
    { label: 'Father Name', value: raw.father_name || raw.parent_name || '—' },
    { label: 'Mobile Num', value: raw.mobile || raw.phone || '—' },
    { label: 'Mother Name', value: raw.mother_name || '—' },
    { label: 'Mobile No', value: raw.mobile_alt || raw.parent_phone || '—' },
    { label: 'Emergency Contact', value: raw.emergency_contact || raw.parent_phone || '—' },
    { label: 'Guardian Name', value: raw.guardian || raw.guardian_name || '—' },
  ];
  return (
    <div className="space-y-6">
      <div className="bg-[#fafafa] rounded-2xl border border-gray-100 py-8 flex flex-col items-center">
        <div className="relative">
          <img src={s.avatar} alt={s.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow" />
          <button className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[#5B5FEF] flex items-center justify-center border-2 border-white"><Pencil className="w-3 h-3 text-white" /></button>
        </div>
        <h3 className="font-poppins text-[18px] font-bold text-[#1a1a1a] mt-3">{s.name}</h3>
        <p className="text-[12px] text-[#8a8a8a]">Admission No: {s.admission_no || '—'}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-5">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-4">
          {fields.map((f) => <Field key={f.label} {...f} />)}
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button className="px-6 h-11 rounded-lg text-[13px] text-[#555] hover:bg-gray-50 border border-gray-200">Cancel</button>
          <button className="px-6 h-11 rounded-lg text-[13px] font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] shadow-sm">Save Changes</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5"><span className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center"><Bus className="w-5 h-5" /></span><div><h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">Transport Assignment</h3><p className="text-[11px] text-[#888]">Choose the student’s route and pickup stop here. No separate Transport assignment screen is required.</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className="block text-[12px] text-[#8a8a8a] mb-1.5">Transport Route</label><select value={transport.transport_route_id} onChange={(e) => { const route = routes.find((item) => item.id === e.target.value); setTransport({ transport_route_id: e.target.value, transport_route: route?.route_name || '', pickup_stop: '' }); setTransportSaved(false); }} className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="">No bus transport</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.route_name}{route.bus_number ? ` · ${route.bus_number}` : ''}</option>)}</select></div>
          <div><label className="block text-[12px] text-[#8a8a8a] mb-1.5">Pickup Stop</label><select value={transport.pickup_stop} disabled={!selectedRoute} onChange={(e) => { setTransport((current) => ({ ...current, pickup_stop: e.target.value })); setTransportSaved(false); }} className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"><option value="">Select pickup stop</option>{(selectedRoute?.stops || []).map((stop) => <option key={stop.name} value={stop.name}>{stop.name}{stop.time ? ` · ${stop.time}` : ''}</option>)}</select></div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">{transportSaved && <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Transport updated</span>}<button onClick={saveTransport} disabled={savingTransport || (transport.transport_route_id && !transport.pickup_stop)} className="px-6 h-11 rounded-lg text-[13px] font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] shadow-sm disabled:opacity-50">{savingTransport ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Transport'}</button></div>
      </div>
    </div>
  );
};

export default ProfileEditTab;
