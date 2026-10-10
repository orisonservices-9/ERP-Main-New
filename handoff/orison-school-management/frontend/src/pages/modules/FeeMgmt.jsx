import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, ProgressBar } from '../../components/Shared';
import { Wallet, TrendingUp, AlertTriangle, Receipt, Download, Plus, Loader2, X } from 'lucide-react';
import api from '../../api';
import { filterRows, downloadCSV } from '../../utils';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const FeeManagement = () => {
  const [all, setAll] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // fee row being collected
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [fees, sum] = await Promise.all([api.get('/fees'), api.get('/fees/summary')]);
    setAll(fees.data); setSummary(sum.data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rows = filterRows(all, q, ['name', 'status']);
  const exportCSV = () => downloadCSV('fees.csv', ['Student', 'Total', 'Paid', 'Due', 'Status'], rows.map((r) => [r.name, r.total, r.paid, r.due, r.status]));

  const openCollect = (r) => { setActive(r); setAmount(String(r.due)); setMethod('Cash'); };
  const submitPay = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alert('Enter a valid amount'); return; }
    if (amt > active.due) { alert(`Amount cannot exceed the due balance (${fmt(active.due)})`); return; }
    setSaving(true);
    await api.post(`/fees/${active.id}/pay`, { amount: amt, method });
    setActive(null); setAmount(''); setSaving(false);
    await load();
  };

  return (
    <Layout>
      <PageTitle title="Fee Management" subtitle="Track collections, dues and process payments."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Collect Fee</Btn></>} />
      <StatCards items={[
        { label: 'Total Collected', value: summary ? fmt(summary.collected) : '—', icon: Wallet, tint: 'bg-green-50 text-green-600', delta: '+8.1%' },
        { label: 'Pending Dues', value: summary ? fmt(summary.pending) : '—', icon: AlertTriangle, tint: 'bg-red-50 text-[#C4141B]' },
        { label: 'Total Billed', value: summary ? fmt(summary.total) : '—', icon: TrendingUp, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Invoices', value: summary ? summary.invoices : '—', icon: Receipt, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Collection Progress" className="lg:col-span-1 self-start">
          {[['Tuition Fees', 88], ['Transport Fees', 72], ['Library & Lab', 64], ['Exam Fees', 95]].map(([k, v]) => (
            <div key={k} className="mb-4 last:mb-0">
              <div className="flex justify-between text-[12px] mb-1.5"><span className="text-[#666]">{k}</span><span className="font-semibold text-[#333]">{v}%</span></div>
              <ProgressBar value={v} color={v >= 85 ? 'bg-green-500' : 'bg-[#C4141B]'} />
            </div>
          ))}
        </Card>
        <Card title="Student Fee Records" className="lg:col-span-2" action={<SearchBar placeholder="Search student..." className="w-48" value={q} onChange={(e) => setQ(e.target.value)} />}>
          {loading ? <div className="flex justify-center py-10 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
            <Table columns={[{ label: 'Student' }, { label: 'Total' }, { label: 'Paid' }, { label: 'Due' }, { label: 'Status' }, { label: 'Action', align: 'right' }]}>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
                  <td className="py-3"><div className="flex items-center gap-3"><img src={r.avatar} alt={r.name} className="w-8 h-8 rounded-full object-cover" /><span className="text-[13px] font-medium text-[#333]">{r.name}</span></div></td>
                  <td className="py-3 text-[13px] text-[#666]">{fmt(r.total)}</td>
                  <td className="py-3 text-[13px] text-[#666]">{fmt(r.paid)}</td>
                  <td className="py-3 text-[13px] font-semibold text-[#333]">{fmt(r.due)}</td>
                  <td className="py-3"><Badge color={r.status === 'Paid' ? 'green' : r.status === 'Partial' ? 'amber' : 'red'}>{r.status}</Badge></td>
                  <td className="py-3 text-right">
                    {r.due > 0 ? (
                      <button onClick={() => openCollect(r)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#C4141B] hover:bg-[#a91116] rounded-lg px-3 py-1.5">Collect Fee</button>
                    ) : <span className="text-[12px] text-green-600 font-medium">Cleared</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No records found.</td></tr>}
            </Table>
          )}
        </Card>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setActive(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-poppins text-[17px] font-bold text-[#1a1a1a]">Collect Fee</h3>
              <button onClick={() => setActive(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-[#888]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <img src={active.avatar} alt={active.name} className="w-10 h-10 rounded-full object-cover" />
              <div><p className="text-[14px] font-semibold text-[#1a1a1a]">{active.name}</p><p className="text-[12px] text-[#888]">Outstanding due: <span className="font-semibold text-[#C4141B]">{fmt(active.due)}</span></p></div>
            </div>
            <label className="block text-[12px] text-[#8a8a8a] mb-1.5">Amount being paid (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[14px] mb-2 focus:outline-none focus:ring-2 focus:ring-red-100" />
            <div className="flex gap-2 mb-4">
              {['Cash', 'Card', 'Online'].map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={`flex-1 h-9 rounded-lg text-[12px] font-medium border transition ${method === m ? 'border-[#C4141B] bg-red-50 text-[#C4141B]' : 'border-gray-200 text-[#555] hover:bg-gray-50'}`}>{m}</button>
              ))}
            </div>
            <div className="flex justify-between text-[13px] mb-4 pt-3 border-t border-gray-100">
              <span className="text-[#666]">Remaining after payment</span>
              <span className="font-semibold text-[#333]">{fmt(Math.max(0, active.due - (parseFloat(amount) || 0)))}</span>
            </div>
            <div className="flex gap-3">
              <Btn variant="outline" className="flex-1" onClick={() => setActive(null)}>Cancel</Btn>
              <button onClick={submitPay} disabled={saving} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium disabled:opacity-70">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit Payment</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
