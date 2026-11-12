import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessPath } from '../roleAccess';

// Renders a student's name as a link to the Student 360 profile (plain text if no id or no access).
const StudentLink = ({ id, name, className = '' }) => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  if (!id || !canAccessPath(auth?.role, '/students/profile', 'student')) return <span className={className}>{name}</span>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/students/profile?id=${id}`); }}
      className={`text-left font-semibold text-indigo-700 underline-offset-2 hover:underline ${className}`}>
      {name}
    </button>
  );
};

export default StudentLink;
