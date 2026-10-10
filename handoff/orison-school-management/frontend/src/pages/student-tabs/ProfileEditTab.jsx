import React from 'react';
import { Pencil, ChevronDown } from 'lucide-react';

const Field = ({ label, value, select }) => (
  <div>
    <label className="block text-[12px] text-[#8a8a8a] mb-1.5">{label}</label>
    <div className="relative">
      <input defaultValue={value} className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition" />
      {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
    </div>
  </div>
);

const ProfileEditTab = ({ detail }) => {
  const s = detail.student;
  const raw = s.raw || {};
  const fields = [
    { label: 'Student Name', value: raw.name || s.name },
    { label: 'Admission No', value: raw.admission_no || s.admission_no },
    { label: 'Class', value: raw.class_name, select: true },
    { label: 'Section', value: raw.section, select: true },
    { label: 'Academic Year', value: raw.academic_year || '2024-2025', select: true },
    { label: 'Status', value: raw.status || s.status },
    { label: 'Blood Group', value: raw.blood_group || '—' },
    { label: 'Date of Birth', value: raw.dob || '—' },
    { label: 'Gender', value: raw.gender || '—', select: true },
    { label: 'Aadhar No', value: raw.aadhar || '—' },
    { label: 'Father Name', value: raw.father_name || raw.parent_name || '—' },
    { label: 'Mobile Num', value: raw.mobile || raw.phone || '—' },
    { label: 'Mother Name', value: raw.mother_name || '—' },
    { label: 'Mobile No', value: raw.mobile_alt || raw.parent_phone || '—' },
    { label: 'Emergency Contact', value: raw.emergency_contact || raw.parent_phone || '—' },
    { label: 'Guardian Name', value: raw.guardian || raw.guardian_name || '—' },
  ];
  return (
    <div className="space-y-6">
      <div className="bg-[#fafafa] rounded-2xl border border-gray-100 py-8 flex flex-col items-center">
        <div className="relative">
          <img src={s.avatar} alt={s.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow" />
          <button className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[#E01E26] flex items-center justify-center border-2 border-white"><Pencil className="w-3 h-3 text-white" /></button>
        </div>
        <h3 className="font-poppins text-[18px] font-bold text-[#1a1a1a] mt-3">{s.name}</h3>
        <p className="text-[12px] text-[#8a8a8a]">Admission No: {s.admission_no || '—'}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-5">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-4">
          {fields.map((f) => <Field key={f.label} {...f} />)}
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button className="px-6 h-11 rounded-lg text-[13px] text-[#555] hover:bg-gray-50 border border-gray-200">Cancel</button>
          <button className="px-6 h-11 rounded-lg text-[13px] font-medium text-white bg-[#C4141B] hover:bg-[#a91116] shadow-sm">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditTab;
