import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, Card, Btn, Badge } from '../../components/Shared';
import { CONVERSATIONS } from '../../mock2';
import { CheckCircle2, AlertTriangle, Info, Send, Search, Loader2 } from 'lucide-react';
import api from '../../api';

const typeIcon = { success: { icon: CheckCircle2, tint: 'bg-green-50 text-green-600' }, warning: { icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600' }, info: { icon: Info, tint: 'bg-blue-50 text-blue-600' } };

export const Notifications = () => {
  const [items, setItems] = useState(null);
  const load = () => api.get('/notifications').then(({ data }) => setItems(data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api.post('/notifications/read-all'); load(); };
  return (
    <Layout>
      <PageTitle title="Notifications" subtitle="Live alerts from admissions, fees and leave activity."
        actions={<Btn variant="outline" onClick={markAll}>Mark all as read</Btn>} />
      <Card pad="p-2">
        {!items ? <div className="flex justify-center py-10 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> :
          items.length === 0 ? <div className="py-10 text-center text-[13px] text-[#999]">No notifications.</div> :
          items.map((n, i) => {
            const t = typeIcon[n.type] || typeIcon.info;
            const Icon = t.icon;
            return (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-xl transition hover:bg-[#fafafa] ${n.unread ? 'bg-red-50/30' : ''}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.tint}`}><Icon className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="text-[14px] font-semibold text-[#1a1a1a]">{n.title}</p>{n.unread && <span className="w-2 h-2 rounded-full bg-[#C4141B]" />}</div>
                  <p className="text-[13px] text-[#666] mt-0.5">{n.body}</p>
                </div>
                <span className="text-[11px] text-[#a0a0a0] shrink-0">{n.time}</span>
              </div>
            );
          })}
      </Card>
    </Layout>
  );
};

export const Communications = () => {
  const [active, setActive] = useState(0);
  const [text, setText] = useState('');
  const msgs = [
    { me: false, text: 'Good morning! Is the PTM confirmed for Saturday?', time: '09:10' },
    { me: true, text: 'Yes, PTM is on Saturday at 10 AM in the main hall.', time: '09:12' },
    { me: false, text: 'Great, thank you for confirming.', time: '09:15' },
  ];
  return (
    <Layout>
      <PageTitle title="Communications" subtitle="Message parents, staff and groups." />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-3 h-[560px]">
        <div className="border-r border-gray-100 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="relative"><Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-1/2 -translate-y-1/2" /><input placeholder="Search chats..." className="w-full h-9 rounded-lg bg-[#f4f4f5] pl-9 pr-3 text-[13px] focus:outline-none" /></div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {CONVERSATIONS.map((c, i) => (
              <button key={i} onClick={() => setActive(i)} className={`w-full flex items-center gap-3 p-4 text-left border-b border-gray-50 transition ${active===i?'bg-red-50/40':'hover:bg-gray-50'}`}>
                <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{c.name}</p>
                  <p className="text-[12px] text-[#888] truncate">{c.last}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-[#a0a0a0]">{c.time}</span>
                  {c.unread > 0 && <span className="w-4 h-4 rounded-full bg-[#C4141B] text-white text-[9px] flex items-center justify-center">{c.unread}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <img src={CONVERSATIONS[active].avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
            <p className="text-[14px] font-semibold text-[#1a1a1a]">{CONVERSATIONS[active].name}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fafafa]">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-[13px] ${m.me ? 'bg-[#C4141B] text-white rounded-br-sm' : 'bg-white border border-gray-100 text-[#333] rounded-bl-sm'}`}>
                  {m.text}
                  <div className={`text-[10px] mt-1 ${m.me ? 'text-white/70' : 'text-[#aaa]'}`}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100 flex items-center gap-3">
            <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="Type a message..." className="flex-1 h-11 rounded-full bg-[#f4f4f5] px-4 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-100" />
            <button onClick={()=>setText('')} className="w-11 h-11 rounded-full bg-[#C4141B] hover:bg-[#a91116] text-white flex items-center justify-center transition"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
