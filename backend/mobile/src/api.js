import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const TOKEN_KEY = 'fitcore.token';
const BASE_KEY  = 'fitcore.baseUrl';

// When you launch Expo Go, the phone reaches your laptop over LAN. Metro exposes
// the laptop's host via Constants.expoConfig.hostUri (e.g. "192.168.0.184:8081").
// We reuse that IP with the backend port so setup is zero-config for most people.
export function defaultBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri
    || Constants.manifest2?.extra?.expoClient?.hostUri
    || Constants.manifest?.debuggerHost
    || Constants.manifest?.hostUri;
  const host = hostUri ? hostUri.split(':')[0] : null;
  if (host) return `http://${host}:3000`;
  return 'http://localhost:3000';
}

// ----- Persisted session -----
export const Session = {
  async getToken()      { return AsyncStorage.getItem(TOKEN_KEY); },
  async setToken(v)     { return v ? AsyncStorage.setItem(TOKEN_KEY, v) : AsyncStorage.removeItem(TOKEN_KEY); },
  async getBaseUrl()    { return (await AsyncStorage.getItem(BASE_KEY)) || defaultBaseUrl(); },
  async setBaseUrl(v)   { return AsyncStorage.setItem(BASE_KEY, v.replace(/\/$/, '')); },
  async clear()         { return AsyncStorage.multiRemove([TOKEN_KEY, BASE_KEY]); },
};

// ----- Fetch wrapper -----
export async function api(path, opts = {}) {
  const base  = await Session.getBaseUrl();
  const token = await Session.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new Error(`Can't reach ${base} — check that the server is running and your phone is on the same Wi-Fi`);
  }

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (res.status === 401) {
    await Session.setToken(null);
    throw new Error('Session expired — please sign in again');
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// ----- Small util helpers used across screens -----
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

export function bmi(kg, cm) {
  if (!kg || !cm) return null;
  const m = cm / 100;
  return kg / (m * m);
}

export function bmiCategory(v) {
  if (v == null) return { label: '—', color: '#A18C89' };
  if (v < 18.5)  return { label: 'Underweight', color: '#A8C8FF' };
  if (v < 25)    return { label: 'Healthy',     color: '#7CDBA5' };
  if (v < 30)    return { label: 'Overweight',  color: '#FFCC7A' };
  return         { label: 'Obese', color: '#FFB4AB' };
}

export function initials(name) {
  return (name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
