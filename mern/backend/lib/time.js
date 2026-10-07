const TZ = 'Asia/Ho_Chi_Minh';

export function localHHMM(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function localYMD(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(date));
}

export function toWorkDate(ymd) {
  return new Date(`${ymd}T00:00:00+07:00`);
}

export function atLocalTime(ymd, hhmm, offsetMinutes = 0) {
  const [h, m] = hhmm.split(':').map(Number);
  const base = new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`);
  return new Date(base.getTime() + offsetMinutes * 60 * 1000);
}
