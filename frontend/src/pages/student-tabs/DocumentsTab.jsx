import React, { useEffect, useMemo, useState } from 'react';
import StudentCard from '../../components/StudentCard';
import api, { API } from '../../api';
import { CheckCircle2, Download, Eye, FileCheck2, FileText, Image, Loader2, Upload } from 'lucide-react';

const DOCUMENTS = [
  { key: 'birth_certificate', name: 'Birth Certificate', note: 'Student date-of-birth record', Icon: FileCheck2 },
  { key: 'transfer_certificate', name: 'Transfer Certificate', note: 'Previous-school transfer record', Icon: FileText },
  { key: 'bonafide_certificate', name: 'Bonafide Certificate', note: 'Alternative previous-school record', Icon: FileText },
  { key: 'address_proof', name: 'Address Proof', note: 'Family residential proof', Icon: FileCheck2 },
  { key: 'student_photo', name: 'Student Photograph', note: 'Recent passport-size photograph', Icon: Image },
  { key: 'aadhaar_card', name: 'Aadhaar Card', note: 'Optional identity document', Icon: FileCheck2 },
  { key: 'medical_record', name: 'Medical Record', note: 'Optional health information', Icon: FileText },
  { key: 'signed_admission_application', name: 'Parent-signed Admission Form', note: 'Permanent signed admission record', Icon: FileText },
];

const backendOrigin = API.replace(/\/api\/?$/, '');
const fileUrl = (document) => document?.url ? `${backendOrigin}${document.url}` : '';
const formatSize = (size) => size ? `${Math.max(1, Math.round(Number(size) / 1024))} KB` : '';

const DocumentsTab = ({ detail }) => {
  const student = detail.student;
  const studentId = student.id;
  const [documents, setDocuments] = useState(student.raw?.admission_documents || {});
  const [uploading, setUploading] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { setDocuments(student.raw?.admission_documents || {}); }, [student.raw?.admission_documents]);
  const uploadedCount = useMemo(() => DOCUMENTS.filter((item) => documents[item.key]).length, [documents]);

  const upload = async (type, file) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    setUploading(type);
    setNotice('');
    try {
      const { data } = await api.post(`/students/${studentId}/documents/${type}`, body);
      setDocuments((current) => ({ ...current, [type]: data }));
      setNotice(`${file.name} uploaded successfully.`);
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Document could not be uploaded.');
    } finally {
      setUploading('');
    }
  };

  return <div className="space-y-6">
    <StudentCard student={student} />
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-950 to-indigo-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[12px] font-bold uppercase tracking-[.18em] text-indigo-200">Student record</p><h3 className="mt-1 font-poppins text-[18px] font-bold">Documents</h3><p className="mt-1 text-[12px] text-indigo-100/70">Upload documents whenever the school receives them. Pending documents do not block admission.</p></div>
        <div className="rounded-2xl bg-white/10 px-5 py-3 text-center backdrop-blur"><b className="block text-[22px]">{uploadedCount}/{DOCUMENTS.length}</b><span className="text-[12px] font-bold uppercase tracking-wider text-indigo-100/70">Uploaded</span></div>
      </div>
      {notice&&<div className="mx-6 mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[12px] font-semibold text-indigo-700">{notice}</div>}
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        {DOCUMENTS.map((item) => {
          const document = documents[item.key];
          const Icon = item.Icon;
          const busy = uploading === item.key;
          return <article key={item.key} className={`rounded-2xl border p-4 transition ${document?'border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white':'border-slate-100 bg-white hover:border-indigo-100 hover:shadow-md'}`}>
            <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${document?'bg-emerald-100 text-emerald-700':'bg-indigo-50 text-indigo-600'}`}>{document?<CheckCircle2 className="h-5 w-5"/>:<Icon className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[13px] font-bold text-slate-800">{item.name}</p><span className={`rounded-full px-2 py-1 text-[12px] font-bold uppercase ${document?'bg-emerald-100 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{document?'Uploaded':'Pending'}</span></div><p className="mt-1 text-[12px] text-slate-400">{item.note}</p>{document&&<p className="mt-2 truncate text-[12px] font-semibold text-slate-500">{document.name}{formatSize(document.size)?` · ${formatSize(document.size)}`:''}</p>}</div></div>
            <div className="mt-4 flex items-center gap-2">{document&&<><a href={fileUrl(document)} target="_blank" rel="noreferrer" className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white text-[12px] font-bold text-emerald-700"><Eye className="h-3.5 w-3.5"/>View</a><a href={fileUrl(document)} download className="flex h-9 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500"><Download className="h-3.5 w-3.5"/></a></>}<label className={`flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-[12px] font-bold text-white ${document?'flex-1':'w-full'} ${busy?'pointer-events-none opacity-60':''}`}>{busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Upload className="h-3.5 w-3.5"/>}{document?'Replace':'Upload'}<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event)=>upload(item.key,event.target.files?.[0])} className="hidden"/></label></div>
          </article>;
        })}
      </div>
    </div>
  </div>;
};

export default DocumentsTab;
