import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { CLASS_LIST } from '../mock';
import { Plus, Download, Upload, User, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../api';

const AddStudentsList = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const toggle = (i) => setChecked((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
  const allChecked = checked.length === CLASS_LIST.length;

  const downloadTemplate = async () => {
    const res = await api.get('/students-template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url; a.download = 'students_template.csv'; a.click();
    window.URL.revokeObjectURL(url);
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/students/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
    } catch (err) {
      setResult({ inserted: 0, errors: [{ row: 0, error: 'Upload failed' }] });
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <Layout showTopBar={false}>
      <div className="pt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="orison-logo text-[26px]">Students</h2>
          <button className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-[#888]"><User className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-poppins text-[17px] font-bold text-[#1a1a1a]">Please select the class to add the details</h3>
          <div className="flex items-center gap-3">
            <button onClick={downloadTemplate} className="flex items-center gap-2 border border-gray-200 text-[#555] text-[13px] font-medium rounded-lg px-4 py-2.5 hover:bg-gray-50"><Download className="w-4 h-4" /> Download Template</button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white text-[13px] font-medium rounded-lg px-4 py-2.5 disabled:opacity-70">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Bulk Upload CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFile} />
            <button onClick={() => navigate('/students/add/new')} className="flex items-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium rounded-lg px-4 py-2.5 shadow-sm transition"><Plus className="w-4 h-4" /> Add New student</button>
          </div>
        </div>

        {result && (
          <div className={`mb-5 rounded-xl border p-4 flex items-start gap-3 ${result.inserted > 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            {result.inserted > 0 ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-[#C4141B] mt-0.5" />}
            <div className="text-[13px]">
              <p className="font-semibold text-[#333]">{result.inserted} student(s) imported successfully.</p>
              {result.errors?.length > 0 && <p className="text-[#C4141B] mt-1">{result.errors.length} row(s) skipped: {result.errors.slice(0, 3).map((e) => `row ${e.row} (${e.error})`).join(', ')}</p>}
              {result.inserted > 0 && <button onClick={() => navigate('/students/view')} className="text-[#C4141B] font-medium hover:underline mt-1">View students →</button>}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_160px_160px] items-center px-6 py-3 border-b border-gray-100">
            <input type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? [] : CLASS_LIST.map((_, i) => i))} className="w-4 h-4 accent-[#C4141B]" />
            <span className="text-center text-[13px] font-medium text-[#777]">Student Data</span>
            <span className="text-center text-[13px] font-medium text-[#777]">Download File</span>
            <span className="text-center text-[13px] font-medium text-[#777]">Upload File</span>
          </div>
          {CLASS_LIST.map((c, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_160px_160px] items-center px-6 py-3 border-b border-gray-50 last:border-0 hover:bg-[#fafafa] transition">
              <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} className="w-4 h-4 accent-[#C4141B]" />
              <span className="text-[13px] text-[#444]">{c}</span>
              <div className="flex justify-center"><button onClick={downloadTemplate} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#888] hover:bg-red-50 hover:text-[#C4141B] transition"><Download className="w-4 h-4" /></button></div>
              <div className="flex justify-center"><button onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#888] hover:bg-red-50 hover:text-[#C4141B] transition"><Upload className="w-4 h-4" /></button></div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6"><button onClick={() => navigate('/students/view')} className="px-8 h-11 rounded-lg text-[13px] font-medium text-white bg-[#C4141B] hover:bg-[#a91116] shadow-sm">Continue</button></div>
      </div>
    </Layout>
  );
};

export default AddStudentsList;
