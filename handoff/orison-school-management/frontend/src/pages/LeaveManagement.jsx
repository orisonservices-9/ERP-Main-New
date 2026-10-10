import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '../api';

const StatusBadge = ({ status }) => {
  const map = { Approved: 'bg-green-50 text-green-600', Rejected: 'bg-red-50 text-[#C4141B]', Pending: 'bg-amber-50 text-amber-600' };
  return <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${map[status]}`}>{status}</span>;
};

const LeaveManagement = () => {
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ leave_type: '', from_date: '', to_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get('/leaves').then(({ data }) => setLeaves(data));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    if (!form.leave_type.trim()) { alert('Please enter a leave type'); return; }
    setSubmitting(true);
    await api.post('/leaves', { name: 'Admin Request', leave_type: form.leave_type, from_date: form.from_date || 'TBD', to_date: form.to_date || 'TBD', days: 1, reason: form.reason, status: 'Pending', avatar: 'https://i.pravatar.cc/80?img=68' });
    setForm({ leave_type: '', from_date: '', to_date: '', reason: '' });
    await load();
    setSubmitting(false);
  };

  const setStatus = async (id, status) => { await api.put(`/leaves/${id}/status`, null, { params: { status } }); load(); };

  const pending = leaves.filter((l) => l.status === 'Pending');

  return (
    <Layout>
      <h2 className="font-poppins text-[24px] font-bold text-[#1a1a1a]">Leave Management</h2>
      <p className="text-[13px] text-[#8a8a8a] mb-6">Manage staff leave requests, approvals, and history records.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#C4141B] px-6 py-3"><h3 className="text-white font-poppins font-semibold text-[15px]">Apply Leave</h3></div>
          <div className="p-6 space-y-4">
            <div><label className="block text-[13px] text-[#555] mb-1.5">Leave Type</label>
              <input value={form.leave_type} onChange={set('leave_type')} placeholder="Select type (e.g. Sick, Casual, Annual)" className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-gray-200 px-3.5 text-[13px] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[13px] text-[#555] mb-1.5">From Date</label><input value={form.from_date} onChange={set('from_date')} placeholder="DD-MM-YYYY" className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-gray-200 px-3.5 text-[13px] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100" /></div>
              <div><label className="block text-[13px] text-[#555] mb-1.5">To Date</label><input value={form.to_date} onChange={set('to_date')} placeholder="DD-MM-YYYY" className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-gray-200 px-3.5 text-[13px] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100" /></div>
            </div>
            <div><label className="block text-[13px] text-[#555] mb-1.5">Reason for Leave</label><textarea value={form.reason} onChange={set('reason')} placeholder="Briefly describe your reason..." rows={3} className="w-full rounded-lg bg-[#f6f6f7] border border-gray-200 px-3.5 py-2.5 text-[13px] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100 resize-none" /></div>
            <div className="flex justify-end"><button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-6 h-11 rounded-lg bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium shadow-sm disabled:opacity-70">{submitting && <Loader2 className="w-4 h-4 animate-spin" />} Submit Application</button></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#C4141B] px-6 py-3"><h3 className="text-white font-poppins font-semibold text-[15px]">Pending Leave Requests</h3></div>
          <div className="p-6 space-y-4">
            {pending.length === 0 && <p className="text-[13px] text-[#999] text-center py-4">No pending requests.</p>}
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div><p className="text-[14px] font-semibold text-[#1a1a1a]">{p.name}</p><p className="text-[12px] text-[#8a8a8a]">{p.leave_type} • {p.from_date} – {p.to_date}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setStatus(p.id, 'Rejected')} className="px-4 h-9 rounded-lg border border-gray-200 text-[12px] text-[#555] hover:bg-gray-50">Reject</button>
                  <button onClick={() => setStatus(p.id, 'Approved')} className="px-4 h-9 rounded-lg bg-[#C4141B] hover:bg-[#a91116] text-white text-[12px] font-medium">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-[#C4141B] px-6 py-3"><h3 className="text-white font-poppins font-semibold text-[15px]">Leave History Records</h3></div>
        <div className="p-6">
          <table className="w-full">
            <thead><tr className="text-[12px] font-semibold text-[#333] border-b-2 border-gray-100"><th className="py-3 text-left">Staff Name</th><th className="py-3 text-left">Leave Type</th><th className="py-3 text-left">From</th><th className="py-3 text-left">To</th><th className="py-3 text-left">Days</th><th className="py-3 text-left">Status</th></tr></thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3"><div className="flex items-center gap-3"><img src={l.avatar} alt={l.name} className="w-8 h-8 rounded-full object-cover" /><span className="text-[13px] font-medium text-[#333]">{l.name}</span></div></td>
                  <td className="py-3 text-[13px] text-[#666]">{l.leave_type}</td>
                  <td className="py-3 text-[13px] text-[#666]">{l.from_date}</td>
                  <td className="py-3 text-[13px] text-[#666]">{l.to_date}</td>
                  <td className="py-3 text-[13px] text-[#666]">{l.days}</td>
                  <td className="py-3"><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[12px] text-[#a0a0a0]">Showing {leaves.length} records</span>
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-[#888] hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button className="w-8 h-8 rounded-lg bg-[#C4141B] text-white text-[12px] font-medium">1</button>
              <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-[#888] hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeaveManagement;
