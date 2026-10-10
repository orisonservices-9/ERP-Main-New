import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, Avatar } from '../../components/Shared';
import { TEACHERS, STAFF } from '../../mock2';
import { Users, UserCheck, UserX, Plus, Download, Phone, Briefcase } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const TeachersManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(TEACHERS, q, ['name', 'id', 'subject', 'classes']);
  const exportCSV = () => downloadCSV('teachers.csv', ['ID', 'Name', 'Subject', 'Classes', 'Phone', 'Status'], rows.map((t) => [t.id, t.name, t.subject, t.classes, t.phone, t.status]));
  return (
    <Layout>
      <PageTitle title="Teachers Management" subtitle="Manage teaching staff, subjects and assignments."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Teacher</Btn></>} />
      <StatCards items={[
        { label: 'Total Teachers', value: '86', icon: Users },
        { label: 'Active', value: '81', icon: UserCheck, tint: 'bg-green-50 text-green-600' },
        { label: 'On Leave', value: '5', icon: UserX, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Subjects Covered', value: '24', icon: Briefcase, tint: 'bg-blue-50 text-blue-600' },
      ]} />
      <Card title="Faculty Directory" action={<SearchBar placeholder="Search teachers..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Teacher'},{label:'ID'},{label:'Subject'},{label:'Classes'},{label:'Contact'},{label:'Status'}]}>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={t.avatar} alt={t.name} /><span className="text-[13px] font-medium text-[#1a1a1a]">{t.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{t.id}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.subject}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.classes}</td>
              <td className="py-3 text-[13px] text-[#666] flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#bbb]" />{t.phone}</td>
              <td className="py-3"><Badge color={t.status === 'Active' ? 'green' : 'amber'}>{t.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No teachers found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const StaffManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(STAFF, q, ['name', 'id', 'role', 'dept']);
  const exportCSV = () => downloadCSV('staff.csv', ['ID', 'Name', 'Role', 'Department', 'Phone', 'Status'], rows.map((t) => [t.id, t.name, t.role, t.dept, t.phone, t.status]));
  return (
    <Layout>
      <PageTitle title="Staff Management" subtitle="Manage non-teaching staff and departments."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Staff</Btn></>} />
      <StatCards items={[
        { label: 'Total Staff', value: '52', icon: Users },
        { label: 'Active', value: '49', icon: UserCheck, tint: 'bg-green-50 text-green-600' },
        { label: 'On Leave', value: '3', icon: UserX, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Departments', value: '8', icon: Briefcase, tint: 'bg-blue-50 text-blue-600' },
      ]} />
      <Card title="Staff Directory" action={<SearchBar placeholder="Search staff..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Staff'},{label:'ID'},{label:'Role'},{label:'Department'},{label:'Contact'},{label:'Status'}]}>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={t.avatar} alt={t.name} /><span className="text-[13px] font-medium text-[#1a1a1a]">{t.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{t.id}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.role}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.dept}</td>
              <td className="py-3 text-[13px] text-[#666] flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#bbb]" />{t.phone}</td>
              <td className="py-3"><Badge color={t.status === 'Active' ? 'green' : 'amber'}>{t.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No staff found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
