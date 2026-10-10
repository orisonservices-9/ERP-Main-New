import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table } from '../../components/Shared';
import { RESULTS } from '../../mock2';
import { GRADE_SHEET, STUDENT } from '../../mock';
import { FileText, CalendarClock, CheckCircle2, Plus, Download, Trophy, Award, Printer, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { filterRows, downloadCSV, printPage } from '../../utils';

export const ViewExam = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/exams').then(({ data }) => { setExams(data); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const cnt = (s) => exams.filter((e) => e.status === s).length;
  const rows = filterRows(exams, q, ['title', 'class_name', 'subject', 'status']);
  const exportCSV = () => downloadCSV('exams.csv', ['Title', 'Class', 'Subject', 'Date', 'Room', 'Status'], rows.map((e) => [e.title, e.class_name, e.subject, e.date, e.room, e.status]));
  return (
    <Layout>
      <PageTitle title="View Exams" subtitle="All scheduled, draft and completed examinations."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus} onClick={() => navigate('/exams/create')}>Create Exam</Btn></>} />
      <StatCards items={[
        { label: 'Total Exams', value: exams.length, icon: FileText },
        { label: 'Scheduled', value: cnt('Scheduled'), icon: CalendarClock, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Completed', value: cnt('Completed'), icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
        { label: 'Drafts', value: cnt('Draft'), icon: FileText, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Examinations" action={<SearchBar placeholder="Search exams..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        {loading ? <div className="flex justify-center py-10 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <Table columns={[{label:'Exam Title'},{label:'Class'},{label:'Subject'},{label:'Date'},{label:'Room'},{label:'Status'}]}>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
                <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{e.title}</td>
                <td className="py-3 text-[13px] text-[#666]">{e.class_name}</td>
                <td className="py-3 text-[13px] text-[#666]">{e.subject}</td>
                <td className="py-3 text-[13px] text-[#666]">{e.date || '—'}</td>
                <td className="py-3 text-[13px] text-[#666]">{e.room || '—'}</td>
                <td className="py-3"><Badge color={e.status==='Completed'?'green':e.status==='Scheduled'?'blue':'amber'}>{e.status}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[#999]">No exams found.</td></tr>}
          </Table>
        )}
      </Card>
    </Layout>
  );
};

export const Results = () => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/results').then(({ data }) => setData(data)).catch(() => {}); }, []);
  const rows = data?.rows || [];
  return (
    <Layout>
      <PageTitle title="Results" subtitle={data ? `${data.exam_title} • ${data.class} • ${data.subject}` : 'Loading...'}
        actions={<><Btn variant="outline" icon={Download} onClick={() => downloadCSV('results.csv', ['Rank', 'Roll', 'Student', 'Total', 'Percent', 'Grade'], rows.map((r) => [r.rank, r.roll, r.name, r.total, r.percent, r.grade]))}>Export</Btn><Btn icon={Trophy} onClick={printPage}>Publish Results</Btn></>} />
      <StatCards items={[
        { label: 'Class Average', value: data ? `${data.class_average}%` : '—', icon: Award, tint: 'bg-green-50 text-green-600' },
        { label: 'Highest Score', value: data ? `${data.highest}%` : '—', icon: Trophy, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Pass Rate', value: data ? `${data.pass_rate}%` : '—', icon: CheckCircle2, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Students', value: data ? data.students : '—', icon: FileText },
      ]} />
      <Card title="Ranked Results" subtitle="Auto-generated from the latest submitted marks">
        {!data ? <div className="flex justify-center py-10 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <Table columns={[{label:'Rank'},{label:'Roll No'},{label:'Student'},{label:'Total'},{label:'Percentage'},{label:'Grade'}]}>
            {rows.map((r) => (
              <tr key={r.roll} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
                <td className="py-3"><Badge color={r.rank<=3?'amber':'gray'}>#{r.rank}</Badge></td>
                <td className="py-3 text-[13px] text-[#666]">{r.roll}</td>
                <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{r.name}</td>
                <td className="py-3 text-[13px] text-[#666]">{r.total}</td>
                <td className="py-3 text-[13px] font-semibold text-[#333]">{r.percent}%</td>
                <td className="py-3"><Badge color={r.percent>=40?'green':'red'}>{r.grade}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[#999]">No results yet. Submit marks from Add Marks.</td></tr>}
          </Table>
        )}
      </Card>
    </Layout>
  );
};

export const ReportCard = () => {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/students/EP-2024-0812/detail').then(({ data }) => setD(data)).catch(() => {}); }, []);
  const s = d?.student || STUDENT;
  const grades = d?.marks || GRADE_SHEET;
  return (
    <Layout>
      <PageTitle title="Report Card" subtitle="Generated from the student's live marks and grades."
        actions={<><Btn variant="outline" icon={Printer} onClick={printPage}>Print</Btn><Btn icon={Download} onClick={printPage}>Download PDF</Btn></>} />
      <Card className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-5 mb-5">
          <div className="flex items-center gap-4">
            <img src={s.avatar} alt={s.name} className="w-16 h-16 rounded-full object-cover" />
            <div><h3 className="font-poppins text-[18px] font-bold text-[#1a1a1a]">{s.name}</h3><p className="text-[12px] text-[#888]">ID: {s.id} • {s.className} • Roll {s.roll}</p></div>
          </div>
          <div className="text-right"><p className="orison-logo text-[20px]">orison</p><p className="text-[11px] text-[#888]">Term 1 Report Card</p></div>
        </div>
        <Table columns={[{label:'Subject'},{label:'Internal'},{label:'External'},{label:'Total'},{label:'Grade'}]}>
          {grades.map((g, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 text-[13px] font-medium text-[#333]">{g.subject}</td>
              <td className="py-2.5 text-[13px] text-[#666]">{g.internal}</td>
              <td className="py-2.5 text-[13px] text-[#666]">{g.external}</td>
              <td className="py-2.5 text-[13px] font-bold text-[#1a1a1a]">{g.total}</td>
              <td className="py-2.5"><Badge color="green">{g.grade}</Badge></td>
            </tr>
          ))}
        </Table>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl bg-[#fcf3ec] p-4 text-center"><p className="text-[22px] font-poppins font-bold text-[#C4141B]">{d?.gpa?.cgpa || '9.42'}</p><p className="text-[11px] text-[#a07a6a]">CGPA</p></div>
          <div className="rounded-xl bg-[#eef6ef] p-4 text-center"><p className="text-[22px] font-poppins font-bold text-green-600">{grades[0]?.grade || 'A+'}</p><p className="text-[11px] text-[#6a7a6b]">Top Grade</p></div>
          <div className="rounded-xl bg-[#eef0f6] p-4 text-center"><p className="text-[22px] font-poppins font-bold text-blue-600">{d?.standing?.rank?.split(' ')[0] || '03'}</p><p className="text-[11px] text-[#6a6f7b]">Class Rank</p></div>
        </div>
      </Card>
    </Layout>
  );
};
