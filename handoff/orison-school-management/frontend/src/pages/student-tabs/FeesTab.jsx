import React, { useState } from 'react';
import StudentCard from '../../components/StudentCard';
import { LAST_YEAR_DUES } from '../../mock';
import { CalendarDays, CreditCard, Wallet, Wifi, Send, Printer, Mail, Check, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../api';
import { printPage } from '../../utils';

const StatusBadge = ({ status }) => {
  const map = { OVERDUE: 'bg-red-50 text-[#C4141B]', PENDING: 'bg-blue-50 text-blue-600' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${map[status]}`}>{status}</span>;
};

const FeesTab = ({ detail }) => {
  const [method, setMethod] = useState('Cash');
  const methods = [{ key: 'Cash', icon: Wallet }, { key: 'Card', icon: CreditCard }, { key: 'Online', icon: Wifi }];
  const pending = detail.fees.pending || [];
  const [due, setDue] = useState(detail.fees.due || 0);
  const [amount, setAmount] = useState(String(detail.fees.due || 0));
  const [paying, setPaying] = useState(false);
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const feeId = detail.fees.fee_id;

  const pay = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alert('Enter a valid amount'); return; }
    if (amt > due) { alert(`Amount cannot exceed the due balance (${fmt(due)})`); return; }
    if (!feeId) { alert('No fee record for this student'); return; }
    setPaying(true);
    await api.post(`/fees/${feeId}/pay`, { amount: amt, method });
    const nd = due - amt;
    setDue(nd); setAmount(String(nd)); setPaying(false);
    alert(`Payment of ${fmt(amt)} recorded. Remaining due: ${fmt(nd)}`);
  };

  return (
    <div className="space-y-6">
      <StudentCard student={detail.student} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">Pending Dues (2024-25)</h3>
              <span className="flex items-center gap-1.5 text-[12px] text-[#777] border border-gray-200 rounded-lg px-2.5 py-1"><CalendarDays className="w-3.5 h-3.5" /> 2024-25</span>
            </div>
            <p className="text-[12px] text-[#a0a0a0] mb-4">Academic Year 2024-25</p>
            {pending.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-green-600 font-medium">🎉 No pending dues — all fees cleared!</div>
            ) : (
              <>
                <div className="grid grid-cols-[24px_1fr_120px_120px] items-center text-[10px] uppercase tracking-wide text-[#a0a0a0] pb-2 border-b border-gray-100"><span></span><span>Fee Description</span><span>Due Date</span><span className="text-right">Amount / Status</span></div>
                {pending.map((d, i) => (
                  <div key={i} className="grid grid-cols-[24px_1fr_120px_120px] items-center py-3 border-b border-gray-50 last:border-0">
                    <span className={`w-4 h-4 rounded flex items-center justify-center ${d.checked ? 'bg-[#C4141B]' : 'border border-gray-300'}`}>{d.checked && <Check className="w-3 h-3 text-white" />}</span>
                    <div><p className="text-[13px] font-semibold text-[#333]">{d.desc}</p><p className="text-[11px] text-[#a0a0a0]">{d.sub}</p></div>
                    <span className="text-[12px] text-[#777]">{d.due}</span>
                    <div className="flex items-center justify-end gap-2"><span className="text-[13px] font-semibold text-[#333]">{d.amount}</span><StatusBadge status={d.status} /></div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">Last Year Dues</h3>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#C4141B] bg-red-50 px-2 py-1 rounded"><AlertTriangle className="w-3.5 h-3.5" /> OVERDUE</span>
            </div>
            <p className="text-[12px] text-[#a0a0a0] mb-3">Unpaid fees carried over from previous academic year</p>
            {LAST_YEAR_DUES.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div><p className="text-[13px] font-semibold text-[#333]">{d.desc}</p><p className="text-[11px] text-[#a0a0a0]">{d.sub}</p></div>
                <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[#333]">{d.amount}</span><StatusBadge status={d.status} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 self-start">
          <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4">Payment Method</h3>
          <div className="space-y-3 mb-5">
            {methods.map((m) => {
              const Icon = m.icon; const active = method === m.key;
              return (
                <button key={m.key} onClick={() => setMethod(m.key)} className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition ${active ? 'border-[#e0b64a] bg-[#fcf7ea]' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-[#C4141B]' : 'text-[#888]'}`} />
                  <span className={`text-[13px] font-medium ${active ? 'text-[#C4141B]' : 'text-[#555]'}`}>{m.key}</span>
                  <span className={`ml-auto w-4 h-4 rounded-full border flex items-center justify-center ${active ? 'border-[#C4141B]' : 'border-gray-300'}`}>{active && <span className="w-2 h-2 rounded-full bg-[#C4141B]" />}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center py-4 border-t border-gray-100">
            <span className="text-[14px] font-semibold text-[#333]">Outstanding Due</span>
            <span className="text-[20px] font-poppins font-bold text-[#C4141B]">{fmt(due)}</span>
          </div>
          <label className="block text-[12px] text-[#8a8a8a] mb-1.5">Amount being paid (₹)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[14px] mb-3 focus:outline-none focus:ring-2 focus:ring-red-100" />
          <button onClick={pay} disabled={paying || due <= 0} className="w-full flex items-center justify-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[14px] font-medium rounded-xl py-3 shadow-sm transition mb-3 disabled:opacity-60">{paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {due <= 0 ? 'Fully Paid' : 'Process Payment'}</button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={printPage} className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-[12px] text-[#555] hover:bg-gray-50"><Printer className="w-3.5 h-3.5" /> Print Receipt</button>
            <button onClick={printPage} className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-[12px] text-[#555] hover:bg-gray-50"><Mail className="w-3.5 h-3.5" /> Email Invoice</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeesTab;
