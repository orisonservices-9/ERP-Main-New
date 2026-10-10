import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, Avatar } from '../../components/Shared';
import { TRANSPORT, VISITORS } from '../../mock2';
import { Bus, MapPin, Users, Wrench, Plus, UserCheck, LogIn, LogOut, Clock, Download } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const Transport = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(TRANSPORT, q, ['route', 'driver', 'bus', 'status']);
  const exportCSV = () => downloadCSV('transport.csv', ['Route', 'Driver', 'Bus', 'Students', 'Stops', 'Status'], rows.map((t) => [t.route, t.driver, t.bus, t.students, t.stops, t.status]));
  return (
    <Layout>
      <PageTitle title="Transport" subtitle="Manage bus routes, drivers and student pickups."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Route</Btn></>} />
      <StatCards items={[
        { label: 'Total Routes', value: '12', icon: MapPin },
        { label: 'Buses Active', value: '9', icon: Bus, tint: 'bg-green-50 text-green-600' },
        { label: 'Students Ferried', value: '384', icon: Users, tint: 'bg-blue-50 text-blue-600' },
        { label: 'In Maintenance', value: '3', icon: Wrench, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Routes & Buses" action={<SearchBar placeholder="Search routes..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Route'},{label:'Driver'},{label:'Bus No.'},{label:'Students'},{label:'Stops'},{label:'Status'}]}>
          {rows.map((t) => (
            <tr key={t.route} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{t.route}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.driver}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.bus}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.students}</td>
              <td className="py-3 text-[13px] text-[#666]">{t.stops}</td>
              <td className="py-3"><Badge color={t.status==='On Route'?'green':t.status==='Idle'?'gray':'amber'}>{t.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No routes found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const VisitorManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(VISITORS, q, ['name', 'purpose', 'host', 'status']);
  const exportCSV = () => downloadCSV('visitors.csv', ['Visitor', 'Purpose', 'Host', 'In', 'Out', 'Status'], rows.map((v) => [v.name, v.purpose, v.host, v.in, v.out, v.status]));
  return (
    <Layout>
      <PageTitle title="Visitor Management" subtitle="Track and log campus visitors in real time."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={UserCheck}>Register Visitor</Btn></>} />
      <StatCards items={[
        { label: 'Total Today', value: '38', icon: Users },
        { label: 'Checked In', value: '31', icon: LogIn, tint: 'bg-green-50 text-green-600' },
        { label: 'Currently Inside', value: '7', icon: Clock, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Checked Out', value: '31', icon: LogOut, tint: 'bg-blue-50 text-blue-600' },
      ]} />
      <Card title="Visitor Log" action={<SearchBar placeholder="Search visitors..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Visitor'},{label:'Purpose'},{label:'Host'},{label:'Check-In'},{label:'Check-Out'},{label:'Status'}]}>
          {rows.map((v, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={v.avatar} alt={v.name} size={8} /><span className="text-[13px] font-medium text-[#333]">{v.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{v.purpose}</td>
              <td className="py-3 text-[13px] text-[#666]">{v.host}</td>
              <td className="py-3 text-[13px] text-[#666]">{v.in}</td>
              <td className="py-3 text-[13px] text-[#666]">{v.out}</td>
              <td className="py-3"><Badge color={v.status==='Inside'?'amber':'green'}>{v.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No visitors found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
