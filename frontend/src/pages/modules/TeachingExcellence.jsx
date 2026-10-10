import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Badge, Btn, Card, PageTitle, StatCards, Table } from '../../components/Shared';
import api from '../../api';
import { BarChart3, BookOpenCheck, CheckCircle2, ClipboardCheck, Plus, Trash2, UserRoundCheck, Users } from 'lucide-react';

const years = ['2026-2027', '2025-2026'];
const cls = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const subjects = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'Computer Science'];
const initialObservation = { teacher_id: '', teacher_name: '', class_name: 'Class 1', section: 'A', subject: 'Mathematics', unit_name: '', observation_date: new Date().toISOString().slice(0, 10), plan_score: 3, behaviour_score: 3, engagement_score: 3, notes: '', academic_year: '2026-2027' };

const Empty = ({ text }) => <div className="py-8 text-center text-[13px] text-[#999]">{text}</div>;
const Select = ({ value, onChange, children }) => <select value={value} onChange={onChange} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-[#444] focus:outline-none focus:ring-2 focus:ring-indigo-100">{children}</select>;

export const TeachingSetup = () => {
  const [data, setData] = useState({ checklist: [], allocations: [] });
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ teacher_id: '', teacher_name: '', subject: 'Mathematics', class_name: 'Class 1', section: 'A', academic_year: '2026-2027' });
  const load = useCallback(async () => {
    const [setup, teacherData] = await Promise.all([api.get('/teaching/setup'), api.get('/teachers')]);
    setData(setup.data); setTeachers(teacherData.data);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  const completed = data.checklist.filter((item) => item.complete).length;
  const add = async () => {
    if (!form.teacher_id) return;
    await api.post('/teacher-allocations', form); setForm((f) => ({ ...f, teacher_id: '', teacher_name: '' })); load();
  };
  const pickTeacher = (id) => { const t = teachers.find((x) => x.id === id); setForm((f) => ({ ...f, teacher_id: id, teacher_name: t?.name || '' })); };
  return <Layout>
    <PageTitle title="Teacher Setup & Allocations" subtitle="Map each class, section and subject to the responsible teacher." />
    <StatCards items={[{ label: 'Setup completed', value: `${completed}/${data.checklist.length || 4}`, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' }, { label: 'Teacher allocations', value: data.allocations.length, icon: UserRoundCheck, tint: 'bg-blue-50 text-blue-600' }, { label: 'Academic year', value: data.academic_year || '2026-2027', icon: BookOpenCheck, tint: 'bg-amber-50 text-amber-600' }, { label: 'Teachers available', value: teachers.length, icon: Users }]} />
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <Card title="School setup checklist" className="xl:col-span-1">
        <div className="space-y-3">{(data.checklist.length ? data.checklist : [{ label: 'Add teacher details' }, { label: 'Add student details' }, { label: 'Allocate subject teachers' }, { label: 'Set up academic calendar' }]).map((item) => <div key={item.label} className="flex items-center gap-3 border-b border-gray-50 pb-3 last:border-0"><CheckCircle2 className={`w-5 h-5 ${item.complete ? 'text-green-500' : 'text-gray-300'}`} /><span className={`text-[13px] ${item.complete ? 'text-[#444]' : 'text-[#888]'}`}>{item.label}</span>{item.complete && <Badge color="green" className="ml-auto">Done</Badge>}</div>)}</div>
      </Card>
      <Card title="Assign a subject teacher" className="xl:col-span-2" action={<Btn icon={Plus} onClick={add}>Save allocation</Btn>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select value={form.teacher_id} onChange={(e) => pickTeacher(e.target.value)}><option value="">Select teacher</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>{subjects.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })}>{cls.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>{['A', 'B', 'C'].map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })}>{years.map((y) => <option key={y}>{y}</option>)}</Select>
        </div>
      </Card>
    </div>
    <Card title="Current allocations" className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Teacher' }, { label: 'Subject' }, { label: 'Class' }, { label: 'Division' }, { label: 'Academic year' }, { label: '' }]}>{data.allocations.map((a) => <tr key={a.id} className="border-b border-gray-50"><td className="py-3 px-6 text-[13px] font-medium">{a.teacher_name}</td><td className="py-3 text-[13px] text-[#666]">{a.subject}</td><td className="py-3 text-[13px] text-[#666]">{a.class_name}</td><td className="py-3 text-[13px] text-[#666]">{a.section}</td><td className="py-3 text-[13px] text-[#666]">{a.academic_year}</td><td className="py-3 pr-6 text-right"><button aria-label="Delete allocation" onClick={async () => { await api.delete(`/teacher-allocations/${a.id}`); load(); }} className="text-indigo-500"><Trash2 className="w-4 h-4" /></button></td></tr>)}</Table>{!data.allocations.length && <Empty text="No allocations yet. Assign a teacher above to begin." />}</div></Card>
  </Layout>;
};

export const ClassroomObservations = () => {
  const [teachers, setTeachers] = useState([]); const [observations, setObservations] = useState([]); const [form, setForm] = useState(initialObservation); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { const [t, o] = await Promise.all([api.get('/teachers'), api.get('/classroom-observations')]); setTeachers(t.data); setObservations(o.data); }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  const choose = (id) => { const t = teachers.find((x) => x.id === id); setForm({ ...form, teacher_id: id, teacher_name: t?.name || '', subject: t?.subject || form.subject }); };
  const save = async () => { if (!form.teacher_id || !form.unit_name) return; setSaving(true); try { await api.post('/classroom-observations', form); setForm(initialObservation); await load(); } finally { setSaving(false); } };
  const scoreTotal = Number(form.plan_score) + Number(form.behaviour_score) + Number(form.engagement_score);
  return <Layout>
    <PageTitle title="Classroom Observation" subtitle="Capture observation evidence and score teaching practice consistently." actions={<Btn icon={Plus} onClick={save}>{saving ? 'Saving…' : 'Save observation'}</Btn>} />
    <StatCards items={[{ label: 'Observations recorded', value: observations.length, icon: ClipboardCheck }, { label: 'Average score', value: observations.length ? `${(observations.reduce((n, x) => n + (x.total_score || 0), 0) / observations.length).toFixed(1)}/15` : '—', icon: BarChart3, tint: 'bg-blue-50 text-blue-600' }, { label: 'This academic year', value: '2026-2027', icon: BookOpenCheck, tint: 'bg-amber-50 text-amber-600' }, { label: 'Teachers observed', value: new Set(observations.map((x) => x.teacher_id)).size, icon: Users, tint: 'bg-green-50 text-green-600' }]} />
    <Card title="New observation"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"><Select value={form.teacher_id} onChange={(e) => choose(e.target.value)}><option value="">Select teacher</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select><Select value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })}>{cls.map((c) => <option key={c}>{c}</option>)}</Select><Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>{subjects.map((s) => <option key={s}>{s}</option>)}</Select><input type="date" value={form.observation_date} onChange={(e) => setForm({ ...form, observation_date: e.target.value })} className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]" /><input value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} placeholder="Unit / chapter name" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] md:col-span-2" /><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observation notes (optional)" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] md:col-span-2" /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">{[['plan_score', 'Follows the plan'], ['behaviour_score', 'Classroom behaviour'], ['engagement_score', 'Student engagement']].map(([key, label]) => <div key={key} className="rounded-xl bg-[#fafafa] p-4"><div className="flex justify-between text-[13px] font-medium"><span>{label}</span><span className="text-[#4F46E5]">{form[key]}/5</span></div><input aria-label={label} type="range" min="0" max="5" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="w-full mt-3 accent-[#4F46E5]" /></div>)}</div><div className="mt-4 text-right text-[13px] font-semibold text-[#444]">Total score: <span className="text-[#4F46E5]">{scoreTotal}/15</span></div></Card>
    <Card title="Observation history" className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Teacher' }, { label: 'Class / Subject' }, { label: 'Unit' }, { label: 'Date' }, { label: 'Scores' }, { label: 'Total' }, { label: '' }]}>{observations.map((o) => <tr key={o.id} className="border-b border-gray-50"><td className="py-3 px-6 text-[13px] font-medium">{o.teacher_name}</td><td className="py-3 text-[13px] text-[#666]">{o.class_name} {o.section} · {o.subject}</td><td className="py-3 text-[13px] text-[#666]">{o.unit_name}</td><td className="py-3 text-[13px] text-[#666]">{o.observation_date}</td><td className="py-3 text-[13px] text-[#666]">{o.plan_score} / {o.behaviour_score} / {o.engagement_score}</td><td className="py-3"><Badge color={(o.total_score || 0) >= 12 ? 'green' : 'amber'}>{o.total_score || 0}/15</Badge></td><td className="py-3 pr-6 text-right"><button aria-label="Delete observation" onClick={async () => { await api.delete(`/classroom-observations/${o.id}`); load(); }} className="text-indigo-500"><Trash2 className="w-4 h-4" /></button></td></tr>)}</Table>{!observations.length && <Empty text="No observations recorded yet." />}</div></Card>
  </Layout>;
};

export const TeacherPerformance = () => {
  const [data, setData] = useState({ rows: [], doing_well: [], needs_support: [] }); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const r = await api.get('/teacher-performance'); setData(r.data); } finally { setLoading(false); } }, []);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);
  const observed = data.rows.filter((x) => x.observations).length;
  return <Layout>
    <PageTitle title="Teacher Performance" subtitle="Use classroom-observation evidence to identify teachers who are doing well and those who need support." actions={<Btn variant="outline" onClick={load}>Refresh</Btn>} />
    <StatCards items={[{ label: 'Teachers assessed', value: observed, icon: Users }, { label: 'Doing well', value: data.doing_well.length, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' }, { label: 'Need support', value: data.needs_support.length, icon: UserRoundCheck, tint: 'bg-amber-50 text-amber-600' }, { label: 'Observations', value: data.rows.reduce((n, x) => n + x.observations, 0), icon: ClipboardCheck, tint: 'bg-blue-50 text-blue-600' }]} />
    <Card title="Aggregate teacher performance" subtitle="Performance score = average classroom observation score, scaled to 100." pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Teacher' }, { label: 'Subject' }, { label: 'Observations' }, { label: 'Average score' }, { label: 'Performance' }, { label: 'Status' }]}>{data.rows.map((x) => <tr key={x.teacher_id || x.teacher_name} className="border-b border-gray-50"><td className="py-3 px-6 text-[13px] font-medium">{x.teacher_name}</td><td className="py-3 text-[13px] text-[#666]">{x.subject || '—'}</td><td className="py-3 text-[13px] text-[#666]">{x.observations}</td><td className="py-3 text-[13px] text-[#666]">{x.observations ? `${x.observation_average}/15` : '—'}</td><td className="py-3 text-[13px] font-semibold">{x.observations ? `${x.performance_score}%` : '—'}</td><td className="py-3 pr-6">{x.observations ? <Badge color={x.performance_score >= 75 ? 'green' : 'amber'}>{x.performance_score >= 75 ? 'Doing well' : 'Needs support'}</Badge> : <Badge>Not assessed</Badge>}</td></tr>)}</Table>{!loading && !data.rows.length && <Empty text="No teacher data available." />}{loading && <Empty text="Loading performance data…" />}</div></Card>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5"><Card title="Teachers doing well" subtitle="Performance score of 75% or more">{data.doing_well.length ? data.doing_well.map((x) => <div key={x.teacher_id} className="flex items-center justify-between border-b border-gray-50 py-3 last:border-0"><span className="text-[13px] font-medium">{x.teacher_name}</span><Badge color="green">{x.performance_score}%</Badge></div>) : <Empty text="No teachers qualify yet. Add observations first." />}</Card><Card title="Teachers who need support" subtitle="Use these insights to plan coaching and follow-up">{data.needs_support.length ? data.needs_support.map((x) => <div key={x.teacher_id} className="flex items-center justify-between border-b border-gray-50 py-3 last:border-0"><span className="text-[13px] font-medium">{x.teacher_name}</span><Badge color="amber">{x.performance_score}%</Badge></div>) : <Empty text="No support flags yet." />}</Card></div>
  </Layout>;
};
