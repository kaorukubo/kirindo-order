'use client';

import { useEffect, useState } from 'react';
import { getStaffName, setStaffName } from '@/lib/staff-session';

interface Props {
  compact?: boolean;
}

export default function StaffNameBar({ compact }: Props) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setName(getStaffName());
  }, []);

  const save = () => {
    setStaffName(name);
    setEditing(false);
  };

  if (compact) {
    return (
      <div className="staff-bar staff-bar--compact">
        {editing ? (
          <>
            <input
              className="staff-bar-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="担当者名"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button type="button" className="staff-bar-btn" onClick={save}>OK</button>
          </>
        ) : (
          <button type="button" className="staff-bar-display" onClick={() => setEditing(true)}>
            👤 {name || '担当者を入力'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="staff-bar">
      <label className="staff-bar-label">担当者</label>
      <input
        className="staff-bar-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        placeholder="名前を入力"
      />
    </div>
  );
}

export function useStaffName(): string {
  const [name, setName] = useState('');
  useEffect(() => {
    setName(getStaffName());
    const onStorage = () => setName(getStaffName());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return name;
}
