import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Upload, Download, Users, ClipboardList, ChevronDown, Loader2 } from 'lucide-react';
import api from '../api';

const SEED_ROWS = [
  { roll: '#102401', name: 'Benjamin Thorne', attendance: 'P', written: 62, practical: 28 },
  { roll: '#102402', name: 'Sophia Martinez', attendance: 'P', written: 55, practical: 24 },
  { roll: '#102404', name: 'Elara Vance', attendance: 'A', written: 68, practical: 29 },
];

const Select = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-wide text-[#a0a0a0] mb-1.5">{label}</label>
    <div className="relative">
      <select value={value} onChange={onChange} className="appearance-none w-full h-10 rounded-lg bg-white border border-gray-200 pl-3 pr-8 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-red-100">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  </div>
);

const AttendancePill = ({ active }) => (
  <div className="flex items-center gap-1.5">
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active === 'P' ? 'bg-[#C4141B] text-white' : 'bg-gray-100 text-gray-400'}`}>P</span>
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active === 'A' ? 'bg-[#C4141B] text-white' : 'bg-gray-100 text-gray-400'}`}>A</span>
  </div>
);

const AddMarks = () => {
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ class_name: 'Grade 10', section: 'Section A', exam_title: 'Mid-Term 2024', subject: 'Advanced Mathematics' });
  const [rows, setRows] = useState(SEED_ROWS);
  const [saving, setSaving] = useState(false);
  const setM = (k) => (e) => setMeta((s) => ({ ...s, [k]: e.target.value }));
  const setCell = (i, k) => (e) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: parseInt(e.target.value) || 0 } : r));

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/marks', {
        exam_title: meta.exam_title, class_name: meta.class_name, section: meta.section, subject: meta.subject,
        max_written: 70, max_practical: 30,
        rows: rows.map((r) => ({ roll: r.roll, name: r.name, written: r.written, practical: r.practical })),
      });
      navigate('/marks/results');
    } catch (e) { setSaving(false); }
  };

  return (
    <Layout>
      <div className="text-[12px] text-[#a0a0a0] mb-2">EXAMS / <span className="text-[#C4141B] font-medium">ADD MARKS</span></div>
      <div className="flex items-start justify-between mb-5">
        <div><h2 className="font-poppins text-[19px] font-bold text-[#1a1a1a]">Add Assessment Marks</h2><p className="text-[13px] text-[#8a8a8a]">Manually input student scores for the final grading period.</p></div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-[12px] text-[#555] border border-gray-200 rounded-lg px-3.5 py-2 hover:bg-gray-50"><Upload className="w-3.5 h-3.5" /> Import CSV</button>
          <button className="flex items-center gap-2 text-[12px] text-[#555] border border-gray-200 rounded-lg px-3.5 py-2 hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> Export List</button>
        </div>
      </div>

      <div className="bg-[#fafafa] rounded-2xl border border-gray-100 p-4 mb-5">
        <div className="flex items-end gap-4">
          <div className="grid grid-cols-4 gap-4 flex-1">
            <Select label="Class" value={meta.class_name} onChange={setM('class_name')} options={['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11']} />
            <Select label="Section" value={meta.section} onChange={setM('section')} options={['Section A', 'Section B']} />
            <Select label="Exam Title" value={meta.exam_title} onChange={setM('exam_title')} options={['Mid-Term 2024', 'Mid-Term 2025', 'Unit Test 3']} />
            <Select label="Subject" value={meta.subject} onChange={setM('subject')} options={['Advanced Mathematics', 'Physics', 'Chemistry']} />
          </div>
          <button className="h-10 px-5 rounded-lg bg-[#1a1a1a] text-white text-[12px] font-semibold">LOAD LIST</button>
        </div>
      </div>

      <div className="flex items-center gap-10 mb-5 px-1">
        <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Users className="w-4 h-4 text-blue-500" /></span><div><p className="text-[10px] uppercase text-[#a0a0a0]">Total Students</p><p className="text-[15px] font-bold text-[#1a1a1a]">{rows.length}</p></div></div>
        <div className="flex items-center gap-3 flex-1 max-w-xs"><span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><ClipboardList className="w-4 h-4 text-[#C4141B]" /></span><div className="flex-1"><p className="text-[10px] uppercase text-[#a0a0a0]">Marks Entered (%)</p><div className="flex items-center gap-2"><span className="text-[13px] font-bold text-[#1a1a1a]">78%</span><div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-[#C4141B]" style={{ width: '78%' }} /></div></div></div></div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[100px_1fr_120px_120px_120px_100px] px-6 py-3 bg-[#f7f7f8] text-[10px] uppercase tracking-wide text-[#a0a0a0] font-medium"><span>Roll No</span><span>Student Name</span><span>Attendance</span><span>Written (70)</span><span>Practical (30)</span><span>Total (100)</span></div>
        {rows.map((r, i) => (
          <div key={r.roll} className="grid grid-cols-[100px_1fr_120px_120px_120px_100px] items-center px-6 py-4 border-b border-gray-50 last:border-0">
            <span className="text-[13px] text-[#666]">{r.roll}</span>
            <span className="text-[13px] font-medium text-[#333]">{r.name}</span>
            <AttendancePill active={r.attendance} />
            <input value={r.written} onChange={setCell(i, 'written')} className="w-16 h-9 rounded-lg bg-[#f6f6f7] border border-gray-200 text-center text-[13px] focus:outline-none focus:ring-2 focus:ring-red-100" />
            <input value={r.practical} onChange={setCell(i, 'practical')} className="w-16 h-9 rounded-lg bg-[#f6f6f7] border border-gray-200 text-center text-[13px] focus:outline-none focus:ring-2 focus:ring-red-100" />
            <span className="text-[14px] font-bold text-[#1a1a1a]">{(r.written || 0) + (r.practical || 0)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <span className="text-[12px] text-[#a0a0a0]">Draft auto-saved at 14:32 PM</span>
        <button className="px-5 h-11 rounded-lg border border-gray-200 text-[12px] font-semibold text-[#555] hover:bg-gray-50">SAVE AS DRAFT</button>
        <button onClick={submit} disabled={saving} className="flex items-center gap-2 px-6 h-11 rounded-lg bg-[#C4141B] hover:bg-[#a91116] text-white text-[12px] font-semibold shadow-sm disabled:opacity-70">{saving && <Loader2 className="w-4 h-4 animate-spin" />} SUBMIT & FINALIZE</button>
      </div>
    </Layout>
  );
};

export default AddMarks;
