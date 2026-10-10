import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, Card, Btn, Badge, Field, Table, Avatar } from '../../components/Shared';
import { PROMOTE_STUDENTS } from '../../mock2';
import { STUDENTS as VIEW_STUDENTS } from '../../mock';
import { ArrowRightLeft, GraduationCap, Check } from 'lucide-react';

export const PromoteStudent = () => {
  const [selected, setSelected] = useState(PROMOTE_STUDENTS.filter(s => s.result === 'Pass').map(s => s.roll));
  const toggle = (r) => setSelected((s) => s.includes(r) ? s.filter(x => x !== r) : [...s, r]);
  return (
    <Layout>
      <PageTitle title="Promote Student" subtitle="Move students to the next grade for the new academic session." />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Field label="From Class" select value="Grade 10 - B" options={['Grade 9 - A', 'Grade 11 - B']} />
        <Field label="To Class" select value="Grade 11 - B" options={['Grade 10 - B', 'Grade 12 - A']} />
        <Field label="Academic Year" select value="2025-2026" options={['2024-2025']} />
        <div className="flex items-end"><Btn icon={GraduationCap} className="w-full">Promote Selected ({selected.length})</Btn></div>
      </div>
      <Card title="Eligible Students" subtitle="Review results before promoting">
        <Table columns={[{label:''},{label:'Student'},{label:'Current Class'},{label:'Result'},{label:'Score'},{label:'Promote',align:'center'}]}>
          {PROMOTE_STUDENTS.map((s) => (
            <tr key={s.roll} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 w-8"><span className="text-[12px] text-[#aaa]">{s.roll}</span></td>
              <td className="py-3"><div className="flex items-center gap-3"><Avatar src={s.avatar} alt={s.name} /><span className="text-[13px] font-medium text-[#1a1a1a]">{s.name}</span></div></td>
              <td className="py-3 text-[13px] text-[#666]">{s.current}</td>
              <td className="py-3"><Badge color={s.result === 'Pass' ? 'green' : 'red'}>{s.result}</Badge></td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{s.percent}</td>
              <td className="py-3 text-center">
                <button onClick={() => toggle(s.roll)} className={`w-5 h-5 rounded flex items-center justify-center mx-auto ${selected.includes(s.roll) ? 'bg-[#C4141B]' : 'border border-gray-300'}`}>
                  {selected.includes(s.roll) && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </Layout>
  );
};

export const TransferStudent = () => {
  const list = VIEW_STUDENTS;
  return (
    <Layout>
      <PageTitle title="Transfer Student" subtitle="Issue transfer certificates and move students between branches." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Transfer Details" className="lg:col-span-1 self-start">
          <div className="space-y-4">
            <Field label="Select Student" select value="Marcus Thorne" options={list.map(s=>s.name)} />
            <Field label="Transfer Type" select value="Branch Transfer" options={['School Withdrawal', 'Section Change']} />
            <Field label="Destination" select value="Orison North Branch" options={['Orison East Branch', 'Orison West Branch']} />
            <Field label="Reason" placeholder="Enter reason for transfer" />
            <Field label="Effective Date" type="date" />
            <div className="flex gap-3 pt-2">
              <Btn variant="outline" className="flex-1">Cancel</Btn>
              <Btn icon={ArrowRightLeft} className="flex-1">Issue Transfer</Btn>
            </div>
          </div>
        </Card>
        <Card title="Recent Transfers" className="lg:col-span-2 self-start">
          <Table columns={[{label:'Student'},{label:'From'},{label:'To'},{label:'Date'},{label:'Status'}]}>
            {list.slice(0,4).map((s,i) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0">
                <td className="py-3"><div className="flex items-center gap-3"><Avatar src={s.avatar} alt={s.name}/><span className="text-[13px] font-medium text-[#333]">{s.name}</span></div></td>
                <td className="py-3 text-[13px] text-[#666]">Central Campus</td>
                <td className="py-3 text-[13px] text-[#666]">{['North','East','West','North'][i]} Branch</td>
                <td className="py-3 text-[13px] text-[#666]">Jul {10+i}, 2025</td>
                <td className="py-3"><Badge color={i%2? 'amber':'green'}>{i%2? 'Pending':'Completed'}</Badge></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </Layout>
  );
};
