import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, ProgressBar } from '../../components/Shared';
import { HOMEWORK, TIMETABLE } from '../../mock2';
import { BookOpen, CheckCircle2, Clock, FileText, Plus, CalendarDays, Download } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const HomeworkManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(HOMEWORK, q, ['title', 'subject', 'class']);
  const exportCSV = () => downloadCSV('homework.csv', ['Title', 'Subject', 'Class', 'Due', 'Submitted', 'Assigned', 'Status'], rows.map((h) => [h.title, h.subject, h.class, h.due, h.submitted, h.assigned, h.status]));
  return (
    <Layout>
      <PageTitle title="Homework Management" subtitle="Assign, track and review homework submissions."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Assign Homework</Btn></>} />
      <StatCards items={[
        { label: 'Active Assignments', value: '18', icon: BookOpen },
        { label: 'Submitted', value: '312', icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
        { label: 'Pending', value: '87', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Closed', value: '24', icon: FileText, tint: 'bg-blue-50 text-blue-600' },
      ]} />
      <Card title="Assignments" action={<SearchBar placeholder="Search..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Title'},{label:'Subject'},{label:'Class'},{label:'Due Date'},{label:'Submissions'},{label:'Status'}]}>
          {rows.map((h) => (
            <tr key={h.title} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{h.title}</td>
              <td className="py-3 text-[13px] text-[#666]">{h.subject}</td>
              <td className="py-3 text-[13px] text-[#666]">{h.class}</td>
              <td className="py-3 text-[13px] text-[#666]">{h.due}</td>
              <td className="py-3 w-40"><div className="flex items-center gap-2"><ProgressBar value={Math.round((h.submitted/h.assigned)*100)} /><span className="text-[11px] text-[#888] shrink-0">{h.submitted}/{h.assigned}</span></div></td>
              <td className="py-3"><Badge color={h.status==='Active'?'blue':'gray'}>{h.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No assignments found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const TimetableManagement = () => {
  const colors = { 'Mathematics':'bg-red-50 text-[#C4141B]','Physics':'bg-blue-50 text-blue-600','Chemistry':'bg-purple-50 text-purple-600','Biology':'bg-green-50 text-green-600','English':'bg-amber-50 text-amber-600','Computer Sc.':'bg-cyan-50 text-cyan-600','Sports':'bg-orange-50 text-orange-600','Library':'bg-gray-100 text-gray-600','Arts':'bg-pink-50 text-pink-600','Music':'bg-indigo-50 text-indigo-600' };
  return (
    <Layout>
      <PageTitle title="Timetable Management" subtitle="Weekly class schedule • Grade 10 - A"
        actions={<><Btn variant="outline" icon={CalendarDays}>Grade 10 - A</Btn><Btn icon={Plus}>Add Period</Btn></>} />
      <Card pad="p-5">
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: '6px' }}>
            <thead><tr><th className="text-[11px] text-[#a0a0a0] font-medium w-20">Time</th>{TIMETABLE.days.map((d) => <th key={d} className="text-[12px] font-semibold text-[#333] py-2">{d}</th>)}</tr></thead>
            <tbody>
              {TIMETABLE.periods.map((p) => (
                <tr key={p}>
                  <td className="text-[11px] text-[#888] font-medium text-center">{p}</td>
                  {TIMETABLE.grid[p].map((subj, i) => (<td key={i}><div className={`rounded-lg py-3 px-2 text-center text-[12px] font-medium ${colors[subj] || 'bg-gray-100 text-gray-600'}`}>{subj}</div></td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
};
