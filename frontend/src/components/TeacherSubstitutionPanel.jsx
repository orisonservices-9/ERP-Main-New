import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, RefreshCw, UserRoundCheck } from 'lucide-react';
import api from '../api';

const todayText = () => new Date().toISOString().slice(0, 10);

const TeacherSubstitutionPanel = ({ compact = false }) => {
  const [targetDate, setTargetDate] = useState(todayText());
  const [data, setData] = useState({ affected_teachers: [], affected_periods: [], unassigned_periods: 0 });
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setNotice('');
    try {
      const response = await api.get('/teacher-substitution-alerts', { params: { target_date: targetDate } });
      setData(response.data || { affected_teachers: [], affected_periods: [], unassigned_periods: 0 });
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Could not load timetable coverage for this date.');
    } finally { setLoading(false); }
  }, [targetDate]);

  useEffect(() => { load(); }, [load]);

  const assign = async (period) => {
    const substituteTeacherId = choices[period.id];
    if (!substituteTeacherId) { setNotice('Choose an available substitute teacher first.'); return; }
    setSaving(period.id); setNotice('');
    try {
      await api.post('/teacher-substitutions', { period_id: period.id, date: targetDate, substitute_teacher_id: substituteTeacherId, note: 'Assigned from Leave / Timetable Management' });
      setNotice('Substitute teacher assigned. The affected period is now covered.');
      await load();
    } catch (error) { setNotice(error.response?.data?.detail || 'Could not assign this substitute teacher.'); }
    finally { setSaving(''); }
  };

  const affected = data.affected_periods || [];
  return <section className={`overflow-hidden rounded-[26px] border border-indigo-100 bg-white shadow-[0_14px_36px_rgba(49,46,129,.08)] ${compact ? 'mb-5' : 'mb-6'}`}>
    <div className="flex flex-col gap-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 p-5 text-white lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10"><UserRoundCheck className="h-5 w-5 text-indigo-100" /></span><div><p className="text-[12px] font-bold uppercase tracking-[.16em] text-indigo-200">Teacher leave coverage</p><h3 className="mt-1 font-poppins text-[18px] font-bold">Substitute teacher desk</h3><p className="mt-1 text-[12px] text-indigo-100/70">Approved teacher leave is matched automatically with the selected day’s timetable.</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><label className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-[12px] font-bold"><CalendarDays className="h-4 w-4" /><input aria-label="Substitution date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="bg-transparent text-white outline-none [color-scheme:dark]" /></label><button type="button" onClick={load} className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-[12px] font-bold hover:bg-white/15"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
    </div>
    <div className="p-5">
      <div className="mb-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Teachers away</p><p className="mt-1 text-[20px] font-black text-slate-900">{(data.affected_teachers || []).length}</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-amber-600">Affected periods</p><p className="mt-1 text-[20px] font-black text-amber-800">{affected.length}</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-rose-600">Still uncovered</p><p className="mt-1 text-[20px] font-black text-rose-800">{data.unassigned_periods || 0}</p></div></div>
      {notice && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">{notice}</div>}
      {loading ? <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Checking approved leave and timetable periods…</div> : !affected.length ? <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><div><p className="text-[13px] font-bold text-emerald-900">No timetable coverage is required</p><p className="mt-0.5 text-[12px] text-emerald-700">There are no approved teacher absences affecting scheduled periods on this date.</p></div></div> : <div className="space-y-3">{affected.map((period) => <div key={period.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-[1fr_260px_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-rose-100 px-2.5 py-1 text-[12px] font-bold text-rose-700">{period.teacher_name} away</span><span className="text-[12px] font-semibold text-slate-500">{period.start_time}–{period.end_time}</span></div><p className="mt-2 text-[13px] font-bold text-slate-900">{period.class_name} · {period.section} · {period.subject}</p><p className="mt-1 text-[12px] text-slate-500">{period.leave_type || 'Approved leave'}{period.room ? ` · ${period.room}` : ''}</p></div>{period.substitution ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">Covered by {period.substitution.substitute_teacher_name}</div> : <select value={choices[period.id] || ''} onChange={(event) => setChoices((current) => ({ ...current, [period.id]: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-indigo-300"><option value="">Choose conflict-free teacher</option>{(period.available_substitutes || []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.subject ? ` · ${teacher.subject}` : ''}</option>)}</select>}{period.substitution ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <button type="button" disabled={saving === period.id || !(period.available_substitutes || []).length} onClick={() => assign(period)} className="h-11 rounded-xl bg-indigo-600 px-4 text-[12px] font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{saving === period.id ? 'Assigning…' : 'Assign cover'}</button>}{!period.substitution && !(period.available_substitutes || []).length && <p className="lg:col-start-2 lg:col-span-2 flex items-center gap-2 text-[12px] text-rose-600"><AlertTriangle className="h-4 w-4" />No active, conflict-free teacher is available for this period.</p>}</div>)}</div>}
    </div>
  </section>;
};

export default TeacherSubstitutionPanel;
