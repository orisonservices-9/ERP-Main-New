import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, ProgressBar } from '../../components/Shared';
import { BookOpen, GraduationCap, Percent, Users, CalendarCheck, CheckCircle2, XCircle, Clock, Plus, Download } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const AcademicsManagement = () => {
  const subjects = [
    { name: 'Mathematics', teacher: 'Vikram Nair', classes: 8, avg: 82 },
    { name: 'Physics', teacher: 'Dr. Anita Rao', classes: 5, avg: 78 },
    { name: 'Chemistry', teacher: 'Rahul Menon', classes: 6, avg: 74 },
    { name: 'Biology', teacher: 'Priya Das', classes: 4, avg: 80 },
    { name: 'English', teacher: 'Sneha Kapoor', classes: 9, avg: 85 },
    { name: 'Computer Science', teacher: 'Arjun Sethi', classes: 5, avg: 88 },
  ];
  const [q, setQ] = useState('');
  const rows = filterRows(subjects, q, ['name', 'teacher']);
  const exportCSV = () => downloadCSV('subjects.csv', ['Subject', 'Teacher', 'Classes', 'Avg'], rows.map((s) => [s.name, s.teacher, s.classes, s.avg]));
  return (
    <Layout>
      <PageTitle title="Academics Management" subtitle="Manage curriculum, subjects, and class performance."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Subject</Btn></>} />
      <StatCards items={[
        { label: 'Total Subjects', value: '24', icon: BookOpen, delta: '+2' },
        { label: 'Active Classes', value: '38', icon: GraduationCap, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Avg. Performance', value: '81.4%', icon: Percent, tint: 'bg-green-50 text-green-600', delta: '+3.1%' },
        { label: 'Enrolled Students', value: '1,284', icon: Users, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Subjects Overview" action={<SearchBar placeholder="Search subjects..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Subject'},{label:'Lead Teacher'},{label:'Classes'},{label:'Avg. Score'},{label:'Performance'}]}>
          {rows.map((s) => (
            <tr key={s.name} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{s.name}</td>
              <td className="py-3 text-[13px] text-[#666]">{s.teacher}</td>
              <td className="py-3 text-[13px] text-[#666]">{s.classes}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{s.avg}%</td>
              <td className="py-3 w-48"><ProgressBar value={s.avg} color={s.avg>=85?'bg-green-500':s.avg>=75?'bg-[#C4141B]':'bg-amber-500'} /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[13px] text-[#999]">No subjects found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const AttendanceManagement = () => {
  const data = [
    { class: 'Grade 10 - A', total: 42, present: 39, absent: 2, late: 1 },
    { class: 'Grade 10 - B', total: 45, present: 41, absent: 3, late: 1 },
    { class: 'Grade 9 - A', total: 38, present: 36, absent: 1, late: 1 },
    { class: 'Grade 9 - B', total: 40, present: 33, absent: 5, late: 2 },
    { class: 'Grade 11 - B', total: 44, present: 42, absent: 1, late: 1 },
  ];
  const [q, setQ] = useState('');
  const rows = filterRows(data, q, ['class']);
  const exportCSV = () => downloadCSV('attendance.csv', ['Class', 'Total', 'Present', 'Absent', 'Late'], rows.map((r) => [r.class, r.total, r.present, r.absent, r.late]));
  return (
    <Layout>
      <PageTitle title="Attendance Management" subtitle="Track daily attendance across all classes."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={CheckCircle2}>Mark Attendance</Btn></>} />
      <StatCards items={[
        { label: 'Present Today', value: '1,209', icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
        { label: 'Absent Today', value: '52', icon: XCircle, tint: 'bg-red-50 text-[#C4141B]' },
        { label: 'Late Arrivals', value: '23', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Attendance Rate', value: '94.2%', icon: CalendarCheck, tint: 'bg-blue-50 text-blue-600', delta: '+1.3%' },
      ]} />
      <Card title="Class-wise Attendance" subtitle="Today’s summary" action={<SearchBar placeholder="Search class..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Class'},{label:'Total'},{label:'Present'},{label:'Absent'},{label:'Late'},{label:'Rate'}]}>
          {rows.map((r) => {
            const rate = Math.round((r.present / r.total) * 100);
            return (
              <tr key={r.class} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
                <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{r.class}</td>
                <td className="py-3 text-[13px] text-[#666]">{r.total}</td>
                <td className="py-3"><Badge color="green">{r.present}</Badge></td>
                <td className="py-3"><Badge color="red">{r.absent}</Badge></td>
                <td className="py-3"><Badge color="amber">{r.late}</Badge></td>
                <td className="py-3 text-[13px] font-semibold text-[#333]">{rate}%</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No classes found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
