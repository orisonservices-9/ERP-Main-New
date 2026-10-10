import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, BadgeIndianRupee, CalendarCheck2, CheckCircle2,
  ClipboardCheck, Clock3, GraduationCap, ListChecks, Loader2, UserRoundCheck,
  UserRoundX, Users,
} from 'lucide-react';
import Layout from '../../components/Layout';
import { Badge, Btn, Card, PageTitle } from '../../components/Shared';
import api from '../../api';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const queueTone = {
  critical: 'border-rose-100 bg-rose-50 text-rose-600',
  high: 'border-amber-100 bg-amber-50 text-amber-600',
  medium: 'border-blue-100 bg-blue-50 text-blue-600',
  low: 'border-violet-100 bg-violet-50 text-violet-600',
};

export default function ManagementActionCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState({ dashboard: {}, admissions: {}, collections: {}, substitutions: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({});
  const [assigningPeriod, setAssigningPeriod] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, admissions, collections, substitutions] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/admissions-intelligence'),
        api.get('/collections-intelligence'),
        api.get('/teacher-substitution-alerts', { params: { target_date: localDate() } }),
      ]);
      setData({ dashboard: dashboard.data || {}, admissions: admissions.data || {}, collections: collections.data || {}, substitutions: substitutions.data || {} });
    } catch (_) {
      setError('Could not load the school operations queue. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = data.dashboard.stats || {};
  const operations = data.dashboard.operations || {};
  const staleAdmissions = data.admissions.stale?.length || 0;
  const substitutionData = data.substitutions || {};
  const affectedPeriods = substitutionData.affected_periods || [];
  const affectedTeacherNames = (substitutionData.affected_teachers || []).map((item) => item.teacher_name).filter(Boolean).join(', ');

  const assignSubstitute = async (period) => {
    const substituteTeacherId = selectedSubstitutes[period.id];
    if (!substituteTeacherId) { setNotice('Choose an available substitute teacher first.'); return; }
    setAssigningPeriod(period.id); setNotice('');
    try {
      await api.post('/teacher-substitutions', { period_id: period.id, date: substitutionData.date || localDate(), substitute_teacher_id: substituteTeacherId, note: 'Assigned from School Operations Center' });
      setNotice('Substitute teacher assigned. The affected class now has teaching coverage.');
      await load();
    } catch (requestError) {
      setNotice(requestError.response?.data?.detail || 'Could not assign this substitute teacher.');
    } finally { setAssigningPeriod(''); }
  };

  const queue = [
    {
      level: 'critical', count: operations.pending_approvals || 0,
      title: 'Management approvals waiting',
      detail: 'Principal or Director decisions are pending and may block school operations.',
      action: 'Open approvals', path: '/notifications', icon: ClipboardCheck,
    },
    {
      level: 'high', count: stats.attendance_unmarked || 0,
      title: 'Attendance is not complete',
      detail: 'Students still have no attendance status for today.',
      action: 'Complete attendance', path: '/attendance/add', icon: CalendarCheck2,
    },
    {
      level: 'medium', count: staleAdmissions,
      title: 'Admission follow-ups are overdue',
      detail: 'Enquiries have had no follow-up for more than 48 hours.',
      action: 'Open Admissions CRM', path: '/admissions', icon: Users,
    },
    {
      level: 'high', count: operations.overdue_fee_accounts || 0,
      title: 'Fee accounts need follow-up',
      detail: `${money(stats.fees_outstanding)} is currently outstanding across active fee heads.`,
      action: 'Open collection queue', path: '/collections', icon: BadgeIndianRupee,
    },
    {
      level: 'low', count: operations.pending_leaves || 0,
      title: 'Leave requests need review',
      detail: 'Teacher or staff leave requests are awaiting an administrative decision.',
      action: 'Review leave requests', path: '/leave/requests', icon: Clock3,
    },
    {
      level: 'critical', count: substitutionData.unassigned_periods || 0,
      title: 'Teacher substitution required',
      detail: `${affectedTeacherNames || 'An approved teacher leave'} is affecting today’s timetable. Arrange coverage for every period below.`,
      action: 'Arrange substitutes', target: 'teacher-substitutions', icon: UserRoundX,
    },
  ].filter((item) => item.count > 0);

  const openActionCount = queue.reduce((total, item) => total + Number(item.count || 0), 0);

  return (
    <Layout>
      <PageTitle
        title="School Operations Center"
        subtitle="Manage approvals, attendance, admissions, fee follow-ups and people operations from one queue."
        actions={<Btn variant="outline" onClick={load}>Refresh</Btn>}
      />

      {error && <div className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('assigned') ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{notice}</div>}

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 to-violet-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#4F46E5] shadow-sm"><ListChecks className="h-5 w-5" /></span>
          <div>
            <p className="font-poppins text-[22px] font-bold text-slate-900">{loading ? '—' : openActionCount}</p>
            <p className="text-[11px] font-semibold text-slate-600">Open operational actions</p>
          </div>
        </div>
        <p className="max-w-xl text-[11px] leading-5 text-slate-500">Each issue appears only once below. Select an action to continue in its specialised module.</p>
      </div>

      <Card
        title="Operational attention queue"
        subtitle="Only cross-functional administrative work appears here. Academic risks and interventions stay in the Academic Action Center."
      >
        {loading ? (
          <p className="py-8 text-center text-[13px] text-slate-400">Loading school operations…</p>
        ) : queue.length ? (
          <div className="space-y-3">
            {queue.map(({ level, count, title, detail, action, path, target, icon: Icon }) => (
              <div key={title} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${queueTone[level]}`}><Icon className="h-5 w-5" /></span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold text-slate-800">{title}</p><Badge color={level === 'critical' ? 'red' : level === 'high' ? 'amber' : level === 'medium' ? 'blue' : 'purple'}>{count}</Badge></div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
                  </div>
                </div>
                <button onClick={() => target ? document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : navigate(path)} className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#4F46E5]">{action}<ArrowUpRight className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-6 w-6" /></span>
            <p className="mt-3 text-[13px] font-semibold text-slate-800">School operations are on track</p>
            <p className="mt-1 text-[11px] text-slate-400">No administrative exception needs action right now.</p>
          </div>
        )}
      </Card>

      {!loading && (
        <div id="teacher-substitutions" className="scroll-mt-6">
          <Card
            className="mt-5"
            title="Teacher Leave & Substitution"
            subtitle={`${substitutionData.day || 'Today'}, ${substitutionData.date || localDate()}: approved teacher leave is matched automatically with the day’s timetable.`}
          >
            {affectedPeriods.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-9 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><UserRoundCheck className="h-6 w-6" /></span>
                <p className="mt-3 text-[13px] font-semibold text-emerald-900">No teacher leave is affecting today’s timetable</p>
                <p className="mt-1 max-w-xl text-[11px] leading-5 text-emerald-700">When a teacher’s leave is approved, every affected class period will appear here automatically for substitute assignment.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(substitutionData.affected_teachers || []).map((teacher) => (
                    <span key={teacher.teacher_id || teacher.teacher_name} className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
                      <UserRoundX className="h-3.5 w-3.5" />{teacher.teacher_name} · {teacher.leave_type} · {teacher.period_count} period{teacher.period_count === 1 ? '' : 's'}
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {affectedPeriods.map((period) => (
                <div key={period.id} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-[1.25fr_1fr] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">{period.teacher_name} is on leave</p>
                      <Badge color="red">Schedule affected</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{period.start_time}–{period.end_time} · {period.class_name} / {period.section} · {period.subject}{period.room ? ` · ${period.room}` : ''}</p>
                    {period.leave_reason && <p className="mt-1 text-[10px] text-slate-400">Leave reason: {period.leave_reason}</p>}
                  </div>
                  {period.substitution ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <UserRoundCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                      <div><p className="text-[11px] font-semibold text-emerald-800">Covered by {period.substitution.substitute_teacher_name}</p><p className="text-[10px] text-emerald-600">Substitution confirmed by {period.substitution.assigned_by}</p></div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={selectedSubstitutes[period.id] || ''}
                        onChange={(event) => setSelectedSubstitutes((current) => ({ ...current, [period.id]: event.target.value }))}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300"
                      >
                        <option value="">Select available substitute</option>
                        {(period.available_substitutes || []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.subject ? ` · ${teacher.subject}` : ''}</option>)}
                      </select>
                      <Btn onClick={() => assignSubstitute(period)} disabled={assigningPeriod === period.id || !(period.available_substitutes || []).length} icon={assigningPeriod === period.id ? Loader2 : UserRoundCheck}>{assigningPeriod === period.id ? 'Assigning…' : 'Assign substitute'}</Btn>
                    </div>
                  )}
                  {!period.substitution && !(period.available_substitutes || []).length && <p className="lg:col-start-2 text-[10px] text-rose-600">No conflict-free active teacher is available for this period. Update teacher allocation or timetable immediately.</p>}
                </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#4F46E5] shadow-sm"><GraduationCap className="h-5 w-5" /></span>
          <div><p className="text-[13px] font-semibold text-slate-800">Looking for student risk, syllabus delays or interventions?</p><p className="mt-1 text-[11px] text-slate-500">Those academic improvement workflows are managed separately so they do not get mixed with school operations.</p></div>
        </div>
        <Btn onClick={() => navigate('/academics/action-center')}>Open Academic Action Center</Btn>
      </div>
    </Layout>
  );
}
