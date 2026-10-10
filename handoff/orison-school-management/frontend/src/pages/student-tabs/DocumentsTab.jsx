import React from 'react';
import StudentCard from '../../components/StudentCard';
import { FileText, Download, Upload, Eye } from 'lucide-react';

const DOCS = [
  { name: 'Birth Certificate', size: '240 KB', date: 'Uploaded Jun 12, 2024' },
  { name: 'Aadhar Card', size: '180 KB', date: 'Uploaded Jun 12, 2024' },
  { name: 'Previous School TC', size: '512 KB', date: 'Uploaded Jun 15, 2024' },
  { name: 'Medical Record', size: '320 KB', date: 'Uploaded Jul 02, 2024' },
  { name: 'Passport Photo', size: '96 KB', date: 'Uploaded Jun 12, 2024' },
];

const DocumentsTab = ({ detail }) => (
  <div className="space-y-6">
    <StudentCard student={detail.student} />
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">Documents</h3>
        <button className="flex items-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium rounded-lg px-4 py-2.5 shadow-sm transition"><Upload className="w-4 h-4" /> Upload Document</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCS.map((d) => (
          <div key={d.name} className="flex items-center gap-4 rounded-xl border border-gray-100 p-4 hover:bg-[#fafafa] transition">
            <span className="w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center"><FileText className="w-5 h-5 text-[#C4141B]" /></span>
            <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-[#333] truncate">{d.name}</p><p className="text-[11px] text-[#a0a0a0]">{d.size} • {d.date}</p></div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-[#888] hover:bg-gray-50"><Eye className="w-4 h-4" /></button>
              <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-[#888] hover:bg-gray-50"><Download className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default DocumentsTab;
