import { format, formatDistance, parseISO } from 'date-fns';

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d, yyyy · h:mm a');
}

export function formatTime(timeStr: string): string {
  return format(parseISO(`2000-01-01T${timeStr}`), 'h:mm a');
}

export function formatRelative(dateStr: string): string {
  return formatDistance(parseISO(dateStr), new Date(), { addSuffix: true });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}
