import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, Avatar } from '../../components/Shared';
import { QUESTIONS } from '../../mock2';
import { LEAVE_HISTORY } from '../../mock';
import { HelpCircle, Layers, Plus, Download, CalendarCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const QuestionBank = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(QUESTIONS, q, ['q', 'subject', 'type', 'difficulty']);
  const exportCSV = () => downloadCSV('questions.csv', ['Question', 'Subject', 'Type', 'Marks', 'Difficulty'], rows.map((x) => [x.q, x.subject, x.type, x.marks, x.difficulty]));
  return (
    <Layout>
      <PageTitle title="Question Bank" subtitle="Curate reusable questions across subjects."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Question</Btn></>} />
      <StatCards items={[
        { label: 'Total Questions', value: '2,480', icon: HelpCircle },
        { label: 'Subjects', value: '24', icon: Layers, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Easy', value: '1,040', icon: HelpCircle, tint: 'bg-green-50 text-green-600' },
        { label: 'Hard', value: '386', icon: HelpCircle, tint: 'bg-red-50 text-[#C4141B]' },
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
  const rows = filterRows(LEAVE_HISTORY, q, ['name', 'type', 'status']);
  const exportCSV = () => downloadCSV('leave_report.csv', ['Staff', 'Type', 'From', 'To', 'Days', 'Status'], rows.map((l) => [l.name, l.type, l.from, l.to, l.days, l.status]));
  return (
    <Layout>
      <PageTitle title="Leave Reports" subtitle="Analyse staff leave trends and history."
        actions={<Btn variant="outline" icon={Download} onClick={exportCSV}>Export Report</Btn>} />
      <StatCards items={[
        { label: 'Total Requests', value: '124', icon: CalendarCheck },
        { label: 'Approved', value: '98', icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
        { label: 'Rejected', value: '14', icon: XCircle, tint: 'bg-red-50 text-[#C4141B]' },
        { label: 'Pending', value: '12', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Leave History" action={<SearchBar placeholder="Search staff..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Staff'},{label:'Type'},{label:'From'},{label:'To'},{label:'Days'},{label:'Status'}]}>
          {rows.map((l) => (
            <tr key={l.name} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={l.avatar} alt={l.name} size={8} /><span className="text-[13px] font-medium text-[#333]">{l.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{l.type}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.from}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.to}</td>
              <td className="py-3 text-[13px] text-[#666]">{l.days}</td>
              <td className="py-3"><Badge color={l.status==='Approved'?'green':l.status==='Rejected'?'red':'amber'}>{l.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No records found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
