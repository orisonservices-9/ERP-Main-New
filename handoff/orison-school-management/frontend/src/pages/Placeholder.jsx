import React from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { Construction } from 'lucide-react';

const titleFromPath = (p) => {
  const seg = p.split('/').filter(Boolean);
  const last = seg[seg.length - 1] || 'Page';
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const Placeholder = () => {
  const location = useLocation();
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <Construction className="w-8 h-8 text-[#E01E26]" />
        </div>
        <h2 className="font-poppins text-2xl font-bold text-[#1a1a1a]">{titleFromPath(location.pathname)}</h2>
        <p className="text-[14px] text-[#8a8a8a] mt-2 max-w-md">
          This module is part of the Orison prototype. The screen design is coming soon.
        </p>
      </div>
    </Layout>
  );
};

export default Placeholder;
