import React from 'react';

// Recreated stylized Orison wordmark
const OrisonLogo = ({ size = 'md' }) => {
  const sizes = {
    sm: { main: 'text-[22px]', sub: 'text-[7px]' },
    md: { main: 'text-[34px]', sub: 'text-[10px]' },
    lg: { main: 'text-[52px]', sub: 'text-[14px]' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <div className="flex flex-col items-center leading-none select-none">
      <span className={`orison-logo ${s.main}`}>orison</span>
      <span className={`orison-sub ${s.sub} mt-0.5`}>Services Pvt. Ltd.</span>
    </div>
  );
};

export default OrisonLogo;
