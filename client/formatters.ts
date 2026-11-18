const dateTime = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const time = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}

export function formatTimeWindow(start: string, end: string): string {
  return `${time.format(new Date(start))} – ${time.format(new Date(end))}`;
}
