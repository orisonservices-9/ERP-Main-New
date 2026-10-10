import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, Avatar } from '../../components/Shared';
import { PAYROLL, BIOMETRIC } from '../../mock2';
import { BadgeDollarSign, Users, Wallet, TrendingUp, Download, Fingerprint, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const HRPayroll = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(PAYROLL, q, ['name', 'role', 'status']);
  const exportCSV = () => downloadCSV('payslips.csv', ['Employee', 'Role', 'Gross', 'Deductions', 'Net', 'Status'], rows.map((p) => [p.name, p.role, p.gross, p.deductions, p.net, p.status]));
  return (
    <Layout>
      <PageTitle title="HR & Payroll" subtitle="Process salaries and manage payroll cycles."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Payslips</Btn><Btn icon={BadgeDollarSign}>Run Payroll</Btn></>} />
      <StatCards items={[
        { label: 'Total Employees', value: '138', icon: Users },
        { label: 'Payroll (Aug)', value: '₹82.4L', icon: Wallet, tint: 'bg-green-50 text-green-600' },
        { label: 'Avg Salary', value: '₹59,700', icon: TrendingUp, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Pending', value: '6', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Payroll — August 2025" action={<SearchBar placeholder="Search employees..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Employee'},{label:'Role'},{label:'Gross'},{label:'Deductions'},{label:'Net Pay'},{label:'Status'}]}>
          {rows.map((p, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={p.avatar} alt={p.name} size={8} /><span className="text-[13px] font-medium text-[#333]">{p.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{p.role}</td>
              <td className="py-3 text-[13px] text-[#666]">{p.gross}</td>
              <td className="py-3 text-[13px] text-[#C4141B]">-{p.deductions}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{p.net}</td>
              <td className="py-3"><Badge color={p.status==='Paid'?'green':p.status==='Processing'?'blue':'amber'}>{p.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No employees found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const BiometricManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(BIOMETRIC, q, ['name', 'id', 'device', 'status']);
  const exportCSV = () => downloadCSV('biometric.csv', ['Employee', 'ID', 'In', 'Out', 'Device', 'Status'], rows.map((b) => [b.name, b.id, b.in, b.out, b.device, b.status]));
  return (
    <Layout>
      <PageTitle title="Biometric Management" subtitle="Live fingerprint attendance from campus devices."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Fingerprint}>Sync Devices</Btn></>} />
      <StatCards items={[
        { label: 'Devices Online', value: '6 / 6', icon: Fingerprint, tint: 'bg-green-50 text-green-600' },
        { label: 'Present', value: '128', icon: CheckCircle2, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Absent', value: '10', icon: XCircle, tint: 'bg-red-50 text-[#C4141B]' },
        { label: 'Late Punches', value: '7', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Today’s Punch Log" action={<SearchBar placeholder="Search..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Employee'},{label:'ID'},{label:'Punch In'},{label:'Punch Out'},{label:'Device'},{label:'Status'}]}>
          {rows.map((b, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={b.avatar} alt={b.name} size={8} /><span className="text-[13px] font-medium text-[#333]">{b.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{b.id}</td>
              <td className="py-3 text-[13px] text-[#666]">{b.in}</td>
              <td className="py-3 text-[13px] text-[#666]">{b.out}</td>
              <td className="py-3 text-[13px] text-[#666]">{b.device}</td>
              <td className="py-3"><Badge color={b.status==='Present'?'green':'red'}>{b.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No records found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
