import { clsx } from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export const cn = (...x) => twMerge(clsx(x));

export async function api(path, options = {}) {
  const response = await fetch(`/admin/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function useRequest(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const next = await loaderRef.current();
        setData(next);
        return next;
      } catch (cause) {
        setError(cause.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const nf = new Intl.NumberFormat();

export const number = (value) => nf.format(Number(value) || 0);

export const clock = (value = Date.now()) =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(value);

export const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(value)
    : '—';

export const toDateTimeLocal = (epoch) => {
  if (!epoch) return '';
  const date = new Date(Number(epoch) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const fromDateTimeLocal = (value) =>
  value ? Math.floor(new Date(value).getTime() / 1000) : 0;

export const timeAgo = (value) => {
  if (!value) return '—';
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const initials = (value, fallback = 'P') => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const windowStatus = (startAt, endAt, now = Math.floor(Date.now() / 1000)) => {
  if (endAt && endAt <= now) return { key: 'expired', label: 'Expired', tone: 'neutral' };
  if (startAt && startAt > now) return { key: 'scheduled', label: 'Scheduled', tone: 'warn' };
  return { key: 'active', label: 'Active', tone: 'good' };
};

export async function copyText(value) {
  const text = String(value ?? '');
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

export function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text), error: '' };
  } catch (cause) {
    return { ok: false, value: null, error: cause.message };
  }
}
