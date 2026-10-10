import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ChevronLeft, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import api from '../api';

const REQUIRED = ['name', 'admission_no', 'class_name', 'section', 'academic_year', 'gender', 'father_name', 'mobile'];

const AddStudent = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [f, setF] = useState({
    name: '', admission_no: '', class_name: '', section: '', academic_year: '', status: '',
    blood_group: '', dob: '', gender: '', aadhar: '', father_name: '', mobile: '',
    mother_name: '', mobile_alt: '', emergency_contact: '', guardian_name: '',
  });
  const set = (k) => (e) => {
    const val = e.target.value;
    setF((s) => ({ ...s, [k]: val }));
    setErrors((er) => {
      if (!er[k] && !er._form) return er;
      const n = { ...er }; delete n[k]; delete n._form; return n;
    });
  };

  const fields = [
    ['name', 'Student Name', 'Enter student name'],
    ['admission_no', 'Admission no', 'Enter admission number'],
    ['class_name', 'Class', 'Select class', true],
    ['section', 'Section', 'Select section', true],
    ['academic_year', 'Academic year', 'Select year', true],
    ['status', 'Status', 'Active/Tc/Dropout'],
    ['blood_group', 'Blood group', 'e.g. O+'],
    ['dob', 'Date of Birth', 'DD/MM/YYYY'],
    ['gender', 'Gender', 'Select Gender', true],
    ['aadhar', 'Aadhar no', 'XXXX-XXXX-XXXX'],
    ['father_name', 'Father / Guardian Name', 'Enter name'],
    ['mobile', 'Mobile num', '+91 ...'],
    ['mother_name', 'Mother name', 'Enter name'],
    ['mobile_alt', 'Mobile no', '+91 ...'],
    ['emergency_contact', 'Emergency contact', '+91 ...'],
    ['guardian_name', 'Guardian name', 'Guardian name'],
  ];
  const opts = {
    class_name: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
    section: ['Section A', 'Section B', 'Section C'],
    academic_year: ['2024-2025', '2025-2026'],
    gender: ['Male', 'Female', 'Other'],
  };

  const validate = () => {
    const e = {};
    REQUIRED.forEach((k) => { if (!String(f[k] || '').trim()) e[k] = 'This field is required'; });
    if (f.mobile && !e.mobile && !/^[+\d][\d\s-]{9,}$/.test(f.mobile.trim())) e.mobile = 'Enter a valid phone number';
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const { data } = await api.post('/students', f);
      navigate(`/students/profile?id=${data.id}`);
    } catch (err) {
      setSaving(false);
      const detail = err?.response?.data?.detail || 'Something went wrong. Please try again.';
      if (err?.response?.status === 409) setErrors((s) => ({ ...s, admission_no: detail }));
      else setErrors((s) => ({ ...s, _form: detail }));
    }
  };

  const baseInput = 'w-full h-11 rounded-lg bg-[#f6f6f7] px-3.5 text-[13px] text-[#333] focus:outline-none focus:ring-2 transition';

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-[#555]" /></button>
        <h2 className="font-poppins text-[22px] font-bold text-[#1a1a1a]">Add Student</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
        {errors._form && (
          <div data-testid="add-student-form-error" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3.5 flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-[#C4141B] mt-0.5 shrink-0" />
            <p className="text-[13px] text-[#C4141B]">{errors._form}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-5">
          {fields.map(([k, label, ph, select]) => {
            const hasErr = !!errors[k];
            const req = REQUIRED.includes(k);
            return (
              <div key={k}>
                <label className="block text-[13px] text-[#555] mb-1.5">{label}{req && <span className="text-[#C4141B]"> *</span>}</label>
                <div className="relative">
                  {select ? (
                    <select data-testid={`add-student-${k}`} value={f[k]} onChange={set(k)} className={`appearance-none pr-9 border ${baseInput} ${hasErr ? 'border-[#C4141B] ring-red-100 focus:ring-red-100' : 'border-[#ececee] focus:ring-red-100'}`}>
                      <option value="">{ph}</option>
                      {(opts[k] || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input data-testid={`add-student-${k}`} value={f[k]} onChange={set(k)} placeholder={ph} className={`border ${baseInput} placeholder:text-[#b0b0b0] ${hasErr ? 'border-[#C4141B] focus:ring-red-100' : 'border-[#ececee] focus:ring-red-100 focus:border-red-200'}`} />
                  )}
                  {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
                {hasErr && <p data-testid={`add-student-error-${k}`} className="text-[11px] text-[#C4141B] mt-1">{errors[k]}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 mt-8">
          <button data-testid="add-student-cancel-btn" onClick={() => navigate(-1)} className="flex items-center gap-2 px-6 h-11 rounded-lg text-[13px] text-[#555] border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /> Cancel</button>
          <button data-testid="add-student-save-btn" onClick={save} disabled={saving} className="flex items-center gap-2 px-6 h-11 rounded-lg text-[13px] font-medium text-white bg-[#C4141B] hover:bg-[#a91116] shadow-sm disabled:opacity-70">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save & Continue
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default AddStudent;
