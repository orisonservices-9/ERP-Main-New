import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { FileText, Clock, ListChecks, ChevronDown, CalendarClock, Loader2 } from 'lucide-react';
import api from '../api';

const Input = ({ label, placeholder, value, onChange, type = 'text', select, options = [] }) => (
  <div className="flex-1">
    <label className="block text-[10px] uppercase tracking-wide text-[#a0a0a0] mb-1.5 text-center">{label}</label>
    <div className="relative">
      {select ? (
        <select value={value} onChange={onChange} className="appearance-none w-full h-11 rounded-lg bg-[#f0f0f1] border border-[#e6e6e8] px-3.5 pr-9 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-red-100">
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} placeholder={placeholder} value={value} onChange={onChange} className="w-full h-11 rounded-lg bg-[#f0f0f1] border border-[#e6e6e8] px-3.5 text-[13px] text-[#333] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100 transition" />
      )}
      {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
    </div>
  </div>
);

const CreateExam = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ title: '', class_name: 'Grade 10', section: 'Section A', subject: 'Mathematics', date: '', room: '', start_time: '', end_time: '', max_marks: '100', passing_marks: '40' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const schedule = async (status) => {
    if (!f.title.trim()) { alert('Please enter an exam title'); return; }
    setSaving(true);
    try {
      await api.post('/exams', {
        title: f.title, class_name: f.class_name, section: f.section, subject: f.subject,
        date: f.date, room: f.room, start_time: f.start_time, end_time: f.end_time,
        max_marks: parseInt(f.max_marks) || 100, passing_marks: parseInt(f.passing_marks) || 40, status,
      });
      navigate('/exams/view');
    } catch (e) { setSaving(false); }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-poppins text-[24px] font-bold text-[#1a1a1a]">Create New Exam</h2>
        <button className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-[#666] hover:bg-gray-50"><CalendarClock className="w-5 h-5" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#fafafa] rounded-2xl border border-gray-100 p-6">
            <h3 className="flex items-center gap-2 font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4"><FileText className="w-4 h-4 text-[#C4141B]" /> Examination Identity</h3>
            <div className="mb-4"><Input label="Exam Title" placeholder="e.g., First Semester Final" value={f.title} onChange={set('title')} /></div>
            <div className="flex gap-4">
              <Input label="Class" select value={f.class_name} onChange={set('class_name')} options={['Grade 8','Grade 9','Grade 10','Grade 11','Grade 12']} />
              <Input label="Section" select value={f.section} onChange={set('section')} options={['Section A','Section B','Section C']} />
              <Input label="Subject" select value={f.subject} onChange={set('subject')} options={['Mathematics','Physics','Chemistry','Biology','English','Computer Science']} />
            </div>
          </div>

          <div className="bg-[#fafafa] rounded-2xl border border-gray-100 p-6">
            <h3 className="flex items-center gap-2 font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4"><Clock className="w-4 h-4 text-[#C4141B]" /> Date & Time</h3>
            <div className="flex gap-4 mb-4"><Input label="Exam Date" type="date" value={f.date} onChange={set('date')} /><Input label="Hall / Room Number" placeholder="e.g., Auditorium B2" value={f.room} onChange={set('room')} /></div>
            <div className="flex gap-4"><Input label="Start Time" type="time" value={f.start_time} onChange={set('start_time')} /><Input label="End Time" type="time" value={f.end_time} onChange={set('end_time')} /></div>
          </div>

          <div className="bg-[#fafafa] rounded-2xl border border-gray-100 p-6">
            <h3 className="flex items-center gap-2 font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4"><ListChecks className="w-4 h-4 text-[#C4141B]" /> Grading Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Maximum Marks" value={f.max_marks} onChange={set('max_marks')} />
              <Input label="Passing Marks" value={f.passing_marks} onChange={set('passing_marks')} />
            </div>
          </div>
        </div>

        <div className="space-y-4 self-start">
          <div className="bg-[#fafafa] rounded-2xl border border-gray-100 p-6">
            <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4">Quick Summary</h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between"><span className="text-[#888]">Exam Status</span><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-[#C4141B]">DRAFT</span></div>
              <div className="flex items-center justify-between"><span className="text-[#888]">Total Capacity</span><span className="font-semibold text-[#333]">120 Students</span></div>
              <div className="flex items-center justify-between"><span className="text-[#888]">Estimated Duration</span><span className="font-semibold text-[#333]">2 Hours</span></div>
            </div>
          </div>
          <button onClick={() => schedule('Scheduled')} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[14px] font-medium rounded-xl py-3.5 shadow-sm transition disabled:opacity-70">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Schedule Exam</button>
          <button onClick={() => schedule('Draft')} className="w-full text-center text-[13px] text-[#888] hover:text-[#555] py-1">Save as Draft</button>
        </div>
      </div>
    </Layout>
  );
};

export default CreateExam;
