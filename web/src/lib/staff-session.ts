const STAFF_KEY = 'kirindo-staff-name';

export function getStaffName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STAFF_KEY) || '';
}

export function setStaffName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STAFF_KEY, name.trim());
}
