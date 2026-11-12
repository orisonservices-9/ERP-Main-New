import React from 'react';

const StudentCard = ({ student }) => {
  const s = student || {};
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <img src={s.avatar} alt={s.name} className="w-14 h-14 shrink-0 rounded-full object-cover" />
        <div>
          <h3 className="font-poppins text-[19px] font-bold text-[#1a1a1a]">{s.name}</h3>
          <p className="text-[13px] font-semibold text-[#4F46E5] mt-0.5">ID: {s.id}</p>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-2 mt-2">
            <div>
              <p className="text-[12px] uppercase tracking-wide text-[#a0a0a0]">Class</p>
              <p className="text-[12.5px] font-semibold text-[#333]">{s.className}</p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-wide text-[#a0a0a0]">Roll Number</p>
              <p className="text-[12.5px] font-semibold text-[#333]">{s.roll || '—'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:flex-col sm:items-end sm:self-stretch sm:border-0 sm:pt-0">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {s.status}
        </span>
        <div className="text-right">
          <p className="text-[12px] uppercase tracking-wide text-[#a0a0a0]">Outstanding Balance</p>
          <p className="text-[20px] font-poppins font-bold text-[#1a1a1a]">{s.balance}</p>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;
