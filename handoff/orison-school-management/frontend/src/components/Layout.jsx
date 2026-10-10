import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout = ({ children, showTopBar = true }) => {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col bg-white">
        {showTopBar && <TopBar />}
        <div className="flex-1 px-8 pb-10">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
