import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  Plus, Search, Eye, Loader2, Trash2, RefreshCw, X, ShieldAlert,
  Send, KeyRound, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import api from '../api';

const errorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

const ViewStudents = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState('warning');
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [otp, setOtp] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/students')
      .then(({ data }) => {
        setStudents(data);
        setSelectedIds((current) => current.filter((id) => data.some((student) => student.id === id)));
        setLoading(false);
      })
      .catch(() => {
        setError('Students could not be loaded. Please make sure the backend is running, then retry.');
        setLoading(false);
      });
  };
  useEffect(load, []);

  const classes = useMemo(() => [...new Set(students.map((s) => s.class_name).filter(Boolean))].sort(), [students]);
  const sections = useMemo(() => [...new Set(students.filter((s) => !selectedClass || s.class_name === selectedClass).map((s) => s.section).filter(Boolean))].sort(), [students, selectedClass]);
  const filtered = useMemo(() => students.filter((s) => {
    const query = q.trim().toLowerCase();
    const matchesSearch = !query || [s.name, s.id, s.admission_no, s.class_name, s.section].filter(Boolean).some((x) => String(x).toLowerCase().includes(query));
    return matchesSearch && (!selectedClass || s.class_name === selectedClass) && (!selectedSection || s.section === selectedSection);
  }), [students, q, selectedClass, selectedSection]);
  const selectedStudents = useMemo(() => students.filter((student) => selectedIds.includes(student.id)), [students, selectedIds]);
  const visibleIds = filtered.map((student) => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleIds.includes(id))
    : [...new Set([...current, ...visibleIds])]);
  const clearFilters = () => { setQ(''); setSelectedClass(''); setSelectedSection(''); };
  const openProtectedDelete = (ids = selectedIds) => {
    setSelectedIds(ids); setDeleteStep('warning'); setDeleteRequest(null); setOtp(''); setDeleteError(''); setDeleteOpen(true);
  };
  const closeDelete = () => { if (!deleteBusy) { setDeleteOpen(false); setDeleteError(''); } };
  const requestKdmOtp = async () => {
    if (!selectedIds.length) return;
    setDeleteBusy(true); setDeleteError('');
    try {
      const { data } = await api.post('/student-deletion-requests', { student_ids: selectedIds });
      setDeleteRequest(data); setDeleteStep('otp');
    } catch (err) { setDeleteError(errorMessage(err, 'The KDM OTP request could not be created.')); }
    finally { setDeleteBusy(false); }
  };
  const confirmProtectedDelete = async () => {
    if (!deleteRequest?.request_id || otp.length !== 6) return;
    setDeleteBusy(true); setDeleteError('');
    try {
      const { data } = await api.post(`/student-deletion-requests/${deleteRequest.request_id}/confirm`, { otp });
      setDeleteStep('success'); setNotice(data.message); setSelectedIds([]); load();
    } catch (err) { setDeleteError(errorMessage(err, 'The OTP could not be verified. No students were deleted.')); }
    finally { setDeleteBusy(false); }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="font-poppins text-[22px] font-bold text-[#1a1a1a]">View Students</h2><p className="text-[13px] text-[#8a8a8a]">Browse, select and safely manage all enrolled students.</p></div>
        <button onClick={() => navigate('/students/add/new')} className="flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium rounded-lg px-4 py-2.5 shadow-sm transition"><Plus className="w-4 h-4" /> Add New Student</button>
      </div>
      {notice && <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700"><span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</span><button onClick={() => setNotice('')}><X className="w-4 h-4" /></button></div>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm"><Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-1/2 -translate-y-1/2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students..." className="w-full h-10 rounded-lg bg-[#f4f4f5] border border-[#ececee] pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100" /></div>
          <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-[#555] focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="">All Classes</option>{classes.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-[#555] focus:outline-none focus:ring-2 focus:ring-indigo-100"><option value="">All Sections</option>{sections.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          {(q || selectedClass || selectedSection) && <button onClick={clearFilters} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-[13px] text-[#4F46E5] hover:bg-indigo-50"><X className="w-4 h-4" /> Clear</button>}
          {selectedIds.length > 0 && <button onClick={() => openProtectedDelete()} className="ml-auto inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-red-50 border border-red-100 text-[13px] font-semibold text-red-600 hover:bg-red-100"><ShieldAlert className="w-4 h-4" /> Delete selected ({selectedIds.length})</button>}
        </div>
        {error && <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[13px] text-[#4338CA]"><span>{error}</span><button onClick={load} className="inline-flex items-center gap-1.5 font-semibold"><RefreshCw className="w-4 h-4" /> Retry</button></div>}
        {loading ? <div className="flex items-center justify-center py-16 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-[11px] uppercase tracking-wide text-[#9a9a9a] border-b border-gray-100">
            <th className="py-3 pr-3 font-medium"><input aria-label="Select all visible students" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="w-4 h-4 accent-[#4F46E5]" /></th><th className="py-3 font-medium">Student</th><th className="py-3 font-medium">ID</th><th className="py-3 font-medium">Class</th><th className="py-3 font-medium">Section</th><th className="py-3 font-medium">Roll</th><th className="py-3 font-medium">Status</th><th className="py-3 font-medium text-right">Action</th>
          </tr></thead><tbody>
            {filtered.map((s) => <tr key={s.id} className={`border-b border-gray-50 hover:bg-[#fafafa] transition ${selectedIds.includes(s.id) ? 'bg-indigo-50/40' : ''}`}>
              <td className="py-3 pr-3"><input aria-label={`Select ${s.name}`} type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-[#4F46E5]" /></td>
              <td className="py-3"><div className="flex items-center gap-3"><img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-full object-cover" /><span className="text-[13px] font-medium text-[#1a1a1a]">{s.name}</span></div></td><td className="py-3 text-[13px] text-[#666]">{s.id}</td><td className="py-3 text-[13px] text-[#666]">{s.class_name || '—'}</td><td className="py-3 text-[13px] text-[#666]">{s.section || '—'}</td><td className="py-3 text-[13px] text-[#666]">{s.roll || '—'}</td><td className="py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span></td>
              <td className="py-3 text-right"><div className="flex items-center justify-end gap-3"><button onClick={() => navigate(`/students/profile?id=${s.id}`)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#4F46E5] hover:underline"><Eye className="w-4 h-4" /> View</button><button onClick={() => openProtectedDelete([s.id])} title="Protected delete" className="text-[#bbb] hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div></td>
            </tr>)}
            {filtered.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-[13px] text-[#999]">{students.length ? 'No students match your search or filters.' : 'No students found.'}</td></tr>}
          </tbody></table></div>
        )}
      </div>

      {deleteOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4" onMouseDown={(event) => event.target === event.currentTarget && closeDelete()}><div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5"><div className="flex items-center gap-3"><div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${deleteStep === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{deleteStep === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}</div><div><h3 className="text-[18px] font-bold text-slate-900">{deleteStep === 'warning' ? 'Protected student deletion' : deleteStep === 'otp' ? 'Enter KDM OTP' : 'Deletion completed'}</h3><p className="text-[12px] text-slate-500 mt-0.5">{selectedIds.length} student record{selectedIds.length === 1 ? '' : 's'} selected</p></div></div><button onClick={closeDelete} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-500" /></button></div>
        <div className="p-6">
          {deleteStep === 'warning' && <><div className="rounded-2xl border border-red-100 bg-red-50 p-4"><div className="flex gap-3"><AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /><div><p className="text-[13px] font-bold text-red-800">This action cannot be automatically undone.</p><p className="mt-1 text-[12px] leading-5 text-red-700">The selected students will disappear from current admissions and their attendance, marks, unpaid fee dues, transport assignment, interventions and parent access will be removed. Issued fee receipts and the deletion audit record are retained for compliance.</p></div></div></div><div className="mt-4 max-h-36 overflow-auto rounded-xl border border-gray-100 divide-y divide-gray-100">{selectedStudents.map((student) => <div key={student.id} className="px-4 py-2.5 flex justify-between gap-3 text-[12px]"><span className="font-semibold text-slate-800">{student.name}</span><span className="text-slate-500">{student.admission_no || student.id} · {student.class_name} {student.section}</span></div>)}</div><p className="mt-4 text-[12px] leading-5 text-slate-600"><strong>Security:</strong> Requesting the OTP does not delete anything. A 6-digit code is sent to the KDM / Director account, and the Admin must enter it here within 15 minutes.</p></>}
          {deleteStep === 'otp' && <><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 flex gap-3"><Send className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" /><div><p className="text-[13px] font-bold text-indigo-900">Approval request sent to KDM</p><p className="mt-1 text-[12px] leading-5 text-indigo-700">Ask the KDM to verify the student list in the Director approval request and share the OTP. No record will be removed before successful verification.</p></div></div><label className="block mt-5 text-[12px] font-semibold text-slate-700">6-digit KDM OTP</label><div className="relative mt-2"><KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" className="w-full h-14 rounded-xl border border-gray-200 pl-12 pr-4 text-[18px] font-bold tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div><p className="mt-2 text-[11px] text-slate-500">Request ID: {deleteRequest?.request_id} · expires in 15 minutes · maximum 5 attempts</p></>}
          {deleteStep === 'success' && <div className="py-4 text-center"><CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" /><p className="mt-4 text-[15px] font-bold text-slate-900">KDM OTP verified</p><p className="mt-1 text-[13px] text-slate-600">The selected student records were removed and the security audit was saved.</p></div>}
          {deleteError && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-700">{deleteError}</div>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          {deleteStep === 'warning' && <><button onClick={closeDelete} className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-slate-600">Cancel</button><button onClick={requestKdmOtp} disabled={deleteBusy || !selectedIds.length} className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">{deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Request KDM OTP</button></>}
          {deleteStep === 'otp' && <><button onClick={() => { setDeleteStep('warning'); setDeleteError(''); setOtp(''); }} disabled={deleteBusy} className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-slate-600">Back</button><button onClick={confirmProtectedDelete} disabled={deleteBusy || otp.length !== 6} className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">{deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Verify OTP & delete</button></>}
          {deleteStep === 'success' && <button onClick={closeDelete} className="h-10 px-5 rounded-lg bg-[#4F46E5] text-white text-[13px] font-semibold">Done</button>}
        </div>
      </div></div>}
    </Layout>
  );
};

export default ViewStudents;
