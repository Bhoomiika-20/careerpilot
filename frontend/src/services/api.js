import axios from 'axios';
export const baseURL = import.meta.env.VITE_API_URL || '';
export const api = axios.create({ baseURL: baseURL + '/api', withCredentials: true });
let csrfToken;
export async function getCsrf() { if (!csrfToken) csrfToken = (await api.get('/auth/csrf')).data.token; return csrfToken; }
api.interceptors.request.use(async config => { if (!['get','head','options'].includes(config.method)) config.headers['X-CSRF-Token'] = await getCsrf(); return config; });
export const errorText = error => error.response?.data?.message || error.message || 'Something went wrong. Please retry.';
export const date = value => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not provided';
export async function streamChat(body, onEvent) {
  const response = await fetch(baseURL + '/api/chat', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-CSRF-Token': await getCsrf() }, body: JSON.stringify(body) });
  if (!response.ok) { const data = await response.json(); throw new Error(data.message || 'Chat request failed.'); }
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let end; while ((end = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2); const event = frame.split('\n').find(l => l.startsWith('event: '))?.slice(7); const data = frame.split('\n').find(l => l.startsWith('data: '))?.slice(6); if (event && data) onEvent(event, JSON.parse(data)); } }
}
