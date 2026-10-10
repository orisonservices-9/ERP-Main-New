import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Plus, Search, Filter, Eye, Loader2, Trash2 } from 'lucide-react';
import api from '../api';

const ViewStudents = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/students').then(({ data }) => { setStudents(data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const del = async (id) => { await api.delete(`/students/${id}`); load(); };
  const filtered = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.id || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-poppins text-[22px] font-bold text-[#1a1a1a]">View Students</h2>
          <p className="text-[13px] text-[#8a8a8a]">Browse and manage all enrolled students.</p>
        </div>
        <button onClick={() => navigate('/students/add/new')} className="flex items-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium rounded-lg px-4 py-2.5 shadow-sm transition">
          <Plus className="w-4 h-4" /> Add New Student
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students..." className="w-full h-10 rounded-lg bg-[#f4f4f5] border border-[#ececee] pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-100" />
          </div>
          <button className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-200 text-[13px] text-[#555] hover:bg-gray-50"><Filter className="w-4 h-4" /> Filter</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[#9a9a9a] border-b border-gray-100">
                <th className="py-3 font-medium">Student</th><th className="py-3 font-medium">ID</th><th className="py-3 font-medium">Class</th><th className="py-3 font-medium">Roll</th><th className="py-3 font-medium">Status</th><th className="py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-[#fafafa] transition">
                  <td className="py-3"><div className="flex items-center gap-3"><img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-full object-cover" /><span className="text-[13px] font-medium text-[#1a1a1a]">{s.name}</span></div></td>
                  <td className="py-3 text-[13px] text-[#666]">{s.id}</td>
                  <td className="py-3 text-[13px] text-[#666]">{s.class_name} {s.section ? `- ${s.section.replace('Section ','')}` : ''}</td>
                  <td className="py-3 text-[13px] text-[#666]">{s.roll || '—'}</td>
                  <td className="py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span></td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => navigate(`/students/profile?id=${s.id}`)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#C4141B] hover:underline"><Eye className="w-4 h-4" /> View</button>
                      <button onClick={() => del(s.id)} className="text-[#bbb] hover:text-[#C4141B]"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[#999]">No students found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export default ViewStudents;
