import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, Avatar } from '../../components/Shared';
import { QUESTIONS } from '../../mock2';
import { HelpCircle, Layers, Plus, Download, CalendarCheck, CheckCircle2, XCircle, Clock, X, CheckCircle, Sparkles, UsersRound } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';
import api from '../../api';

export const QuestionBank = () => {
  const [q, setQ] = useState('');
  const [questions, setQuestions] = useState(QUESTIONS);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ q: '', subject: 'Mathematics', type: 'Short Answer', marks: 2, difficulty: 'Easy' });
  const [notice, setNotice] = useState('');
  const rows = useMemo(() => filterRows(questions, q, ['q', 'subject', 'type', 'difficulty']), [questions, q]);
  const exportCSV = () => downloadCSV('questions.csv', ['Question', 'Subject', 'Type', 'Marks', 'Difficulty'], rows.map((x) => [x.q, x.subject, x.type, x.marks, x.difficulty]));
  const addQuestion = (e) => {
    e.preventDefault();
    if (!draft.q.trim()) return;
    setQuestions((list) => [{ ...draft, marks: Number(draft.marks) }, ...list]);
    setDraft({ q: '', subject: 'Mathematics', type: 'Short Answer', marks: 2, difficulty: 'Easy' });
    setAdding(false); setNotice('Question added to the bank. It can now be used when creating an exam.');
  };
  return (
    <Layout>
      <PageTitle title="Question Bank" subtitle="Curate reusable questions across subjects."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus} onClick={() => setAdding(true)}>Add Question</Btn></>} />
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-[13px] text-green-700"><span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />{notice}</span><button onClick={() => setNotice('')}><X className="w-4 h-4" /></button></div>}
      {adding && <Card title="Add a reusable question" subtitle="Create it once, then use it in any future exam." className="mb-6">
        <form onSubmit={addQuestion} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <textarea required value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="Type the question" className="md:col-span-3 min-h-20 rounded-lg border border-gray-200 p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          {[['subject',['Mathematics','Science','English','Social Studies','Computer Science']],['type',['Short Answer','Long Answer','Multiple Choice','Numerical']],['difficulty',['Easy','Medium','Hard']]].map(([key, options]) => <select key={key} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px]">{options.map((o) => <option key={o}>{o}</option>)}</select>)}
          <input type="number" min="1" value={draft.marks} onChange={(e) => setDraft({ ...draft, marks: e.target.value })} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px]" placeholder="Marks" />
          <div className="flex gap-3"><Btn type="submit" icon={CheckCircle}>Save Question</Btn><Btn variant="outline" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </form>
      </Card>}
      <StatCards items={[
        { label: 'Total Questions', value: questions.length, icon: HelpCircle },
        { label: 'Subjects', value: '24', icon: Layers, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Easy', value: '1,040', icon: HelpCircle, tint: 'bg-green-50 text-green-600' },
        { label: 'Hard', value: '386', icon: HelpCircle, tint: 'bg-indigo-50 text-[#4F46E5]' },
      ]} />
      <Card title="Questions" action={<SearchBar placeholder="Search questions..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Question'},{label:'Subject'},{label:'Type'},{label:'Marks'},{label:'Difficulty'}]}>
          {rows.map((x, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a] max-w-md">{x.q}</td>
              <td className="py-3 text-[13px] text-[#666]">{x.subject}</td>
              <td className="py-3 text-[13px] text-[#666]">{x.type}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{x.marks}</td>
              <td className="py-3"><Badge color={x.difficulty==='Easy'?'green':x.difficulty==='Medium'?'amber':'red'}>{x.difficulty}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[13px] text-[#999]">No questions found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const LeaveReports = () => {
  const [q, setQ] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/leaves');
        setLeaves(Array.isArray(data) ? data.filter((leave) => leave.person_type !== 'Student') : []);
      } catch (error) {
        setLeaves([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const rows = useMemo(() => {
    const base = filterRows(leaves, q, ['name', 'leave_type', 'person_type', 'status', 'reason']);
    if (!selectedMonth) return base;
    return base.filter((leave) => {
      const appliedMonth = (leave.submitted_at || leave.created || leave.from_date || '').slice(0, 7);
      const fromMonth = (leave.from_date || '').slice(0, 7);
      const toMonth = (leave.to_date || '').slice(0, 7);
      return appliedMonth === selectedMonth || fromMonth === selectedMonth || toMonth === selectedMonth;
    });
  }, [leaves, q, selectedMonth]);

  const exportCSV = () => {
    const headers = ['Staff', 'Role', 'Type', 'From', 'To', 'Days', 'Applied Date', 'Status'];
    const values = rows.map((leave) => [
      leave.name || '—',
      leave.person_type || 'Teacher',
      leave.leave_type || '',
      leave.from_date || '',
      leave.to_date || '',
      leave.days || 0,
      leave.submitted_at ? new Date(leave.submitted_at).toISOString().slice(0, 10) : (leave.created ? new Date(leave.created).toISOString().slice(0, 10) : ''),
      leave.status || 'Pending',
    ]);
    downloadCSV(`leave_report_${selectedMonth || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`, headers, values);
  };

  const stats = {
    total: rows.length,
    approved: rows.filter((leave) => leave.status === 'Approved').length,
    rejected: rows.filter((leave) => leave.status === 'Rejected').length,
    pending: rows.filter((leave) => leave.status === 'Pending').length,
  };
  const approvedDays = rows.filter((leave) => leave.status === 'Approved').reduce((sum, leave) => sum + Number(leave.days || 0), 0);
  const pendingDays = rows.filter((leave) => leave.status === 'Pending').reduce((sum, leave) => sum + Number(leave.days || 0), 0);
  const approvalRate = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0;
  const affectedPeople = new Set(rows.map((leave) => leave.person_id || leave.name).filter(Boolean)).size;

  return (
    <Layout>
      <PageTitle title="Leave Reports" subtitle="Analyse real leave volume, approved absence days and pending staffing impact."
        actions={<Btn variant="outline" icon={Download} onClick={exportCSV}>Export CSV</Btn>} />
      <section className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-7 text-white shadow-[0_24px_60px_rgba(49,46,129,.24)]"><div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-indigo-100"><Sparkles className="h-3.5 w-3.5"/> Leave intelligence</span><h2 className="mt-4 font-poppins text-[27px] font-bold">Absence patterns that support staffing decisions</h2><p className="mt-2 max-w-xl text-[12px] leading-5 text-indigo-100/70">All figures come from submitted and reviewed Teacher/Staff leave records for the selected month.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[CalendarCheck,'Approved days',approvedDays],[Clock,'Pending days',pendingDays],[CheckCircle2,'Approval rate',`${approvalRate}%`],[UsersRound,'People affected',affectedPeople]].map(([Icon,label,value])=><div key={label} className="min-w-[118px] rounded-2xl border border-white/10 bg-white/[.08] p-4"><Icon className="mb-3 h-4 w-4 text-indigo-200"/><p className="font-poppins text-[20px] font-bold">{value}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-indigo-100/55">{label}</p></div>)}</div></div></section>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-[12px] font-medium text-[#555]">Month</label>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-[#444] outline-none focus:border-indigo-300" />
        </div>
        <button type="button" onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))} className="text-[13px] font-medium text-[#4F46E5]">Current month</button>
      </div>
      <Card title="Leave decision register" subtitle={`${stats.total} requests · ${stats.approved} approved · ${stats.pending} pending · ${stats.rejected} rejected`} action={<SearchBar placeholder="Search person, type or status..." className="w-64" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Staff'},{label:'Role'},{label:'Type'},{label:'From'},{label:'To'},{label:'Days'},{label:'Applied Date'},{label:'Status'}]}>
          {loading ? <tr><td colSpan={8} className="py-8 text-center text-[13px] text-[#999]">Loading leave records...</td></tr> : rows.map((l) => (
            <tr key={l.id || `${l.name}-${l.from_date}-${l.to_date}`} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={l.avatar} alt={l.name} size={8} /><span className="text-[13px] font-medium text-[#333]">{l.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{l.person_type || 'Teacher'}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.leave_type}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.from_date}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.to_date}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.days}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.submitted_at ? new Date(l.submitted_at).toLocaleDateString() : (l.created ? new Date(l.created).toLocaleDateString() : '—')}</td>
              <td className="py-3"><Badge color={l.status==='Approved'?'green':l.status==='Rejected'?'red':'amber'}>{l.status}</Badge></td>
            </tr>
          ))}
          {!loading && rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-[13px] text-[#999]">No records found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
