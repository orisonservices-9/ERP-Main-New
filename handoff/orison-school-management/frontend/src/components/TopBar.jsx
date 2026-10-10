import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Users, GraduationCap, BookOpen, LogOut, Loader2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const TopBar = () => {
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) { setResults(null); setMenuOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q } });
        setResults(data);
      } catch (e) { setResults(null); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path) => { setQ(''); setResults(null); navigate(path); };
  const empty = results && !results.students.length && !results.teachers.length && !results.classes.length;

  return (
    <header className="flex items-start justify-between gap-4 px-8 pt-6 pb-4">
      <div>
        <h1 className="font-poppins text-[22px] font-bold text-[#1a1a1a] flex items-center gap-2">
          Welcome back, {auth?.name || 'Admin'} <span className="text-[20px]">👋</span>
        </h1>
        <p className="text-[13px] text-[#8a8a8a] mt-0.5">Here's what's happening in your school today.</p>
      </div>

      <div className="flex items-center gap-4 pt-1" ref={boxRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-[#b0b0b0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anything..."
            className="w-[280px] h-10 rounded-full bg-[#f4f4f5] border border-[#ececee] pl-10 pr-4 text-[13px] text-[#444] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition"
          />
          {(results || loading) && q.trim() && (
            <div className="absolute top-12 right-0 w-[360px] bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
              {loading && <div className="flex items-center gap-2 px-4 py-4 text-[13px] text-[#888]"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
              {!loading && empty && <div className="px-4 py-6 text-center text-[13px] text-[#999]">No results for “{q}”</div>}
              {!loading && results && (
                <div className="py-2">
                  {results.students.length > 0 && (
                    <div><p className="px-4 py-1.5 text-[10px] uppercase tracking-wide text-[#a0a0a0] flex items-center gap-1.5"><Users className="w-3 h-3" /> Students</p>
                      {results.students.map((s) => (
                        <button key={s.id} onClick={() => go('/students/profile')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] text-left">
                          <img src={s.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                          <div><p className="text-[13px] font-medium text-[#333]">{s.name}</p><p className="text-[11px] text-[#999]">{s.class_name} • {s.id}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.teachers.length > 0 && (
                    <div className="mt-1"><p className="px-4 py-1.5 text-[10px] uppercase tracking-wide text-[#a0a0a0] flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> Teachers</p>
                      {results.teachers.map((t) => (
                        <button key={t.id} onClick={() => go('/teachers')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] text-left">
                          <img src={t.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                          <div><p className="text-[13px] font-medium text-[#333]">{t.name}</p><p className="text-[11px] text-[#999]">{t.subject}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.classes.length > 0 && (
                    <div className="mt-1"><p className="px-4 py-1.5 text-[10px] uppercase tracking-wide text-[#a0a0a0] flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Classes</p>
                      {results.classes.map((c) => (
                        <button key={c.name} onClick={() => go('/academics')} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#fafafa] text-left">
                          <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-[#C4141B]" /></span>
                          <p className="text-[13px] font-medium text-[#333]">{c.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <button className="relative w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center hover:bg-[#ececee] transition">
          <Bell style={{ width: 18, height: 18 }} className="text-[#666]" />
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#E01E26] text-white text-[9px] font-bold flex items-center justify-center">4</span>
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-1.5">
            <img src="https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=80&h=80&fit=crop&crop=faces" alt="admin" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
            <ChevronDown className="w-4 h-4 text-[#999]" />
          </button>
          {menuOpen && (
            <div className="absolute top-12 right-0 w-52 bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-[13px] font-semibold text-[#1a1a1a]">{auth?.name || 'Admin'}</p>
                <p className="text-[11px] text-[#999] capitalize">{(auth?.role || '').replace('_', ' ')}</p>
              </div>
              <button onClick={() => { logout(); navigate('/'); }} className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-[#C4141B] hover:bg-red-50"><LogOut className="w-4 h-4" /> Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
