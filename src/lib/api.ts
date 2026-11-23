const API_URL = (import.meta as any).env.VITE_API_URL || '';
let token: string | null = localStorage.getItem('hsi_public_token') || sessionStorage.getItem('hsi_access_token');

export function setToken(value: string | null) {
  token = value;
  localStorage.removeItem('hsi_public_token');
  if (value) sessionStorage.setItem('hsi_access_token', value);
  else sessionStorage.removeItem('hsi_access_token');
}

export function setPersistentPublicToken(value: string | null) {
  token = value;
  sessionStorage.removeItem('hsi_access_token');
  if (value) localStorage.setItem('hsi_public_token', value);
  else localStorage.removeItem('hsi_public_token');
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Falha na comunicação com a plataforma.') as Error & { response?: { data: any } };
    error.response = { data };
    throw error;
  }
  return { data };
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: (path: string, body?: unknown) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  async download(path: string, filename: string) {
    const response = await fetch(API_URL + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Falha ao exportar relatório.'); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }
};

export const auth = {
  async getUser() {
    if (!token) return null;
    try { return (await api.get('/api/auth/me')).data.user; }
    catch { setToken(null); setPersistentPublicToken(null); return null; }
  },
  async register(name: string, email: string, password: string) {
    const response = await api.post('/api/auth/register', { name, email, password });
    setToken(response.data.token);
    return response.data.user;
  },
  async signInWithPassword(email: string, password: string) {
    const response = await api.post('/api/auth/login', { email, password });
    setToken(response.data.token);
    return response.data.user;
  },
  async signOut() { setToken(null); setPersistentPublicToken(null); },
  async requestPasswordReset(email: string) { return api.post('/api/auth/forgot-password', { email }); }
};


export const publicAccess = {
  async register(profile: Record<string, unknown>) {
    const response = await api.post('/api/public/participants', profile);
    setPersistentPublicToken(response.data.token);
    return response.data;
  },
  async resume(participantCode: string) {
    const response = await api.post('/api/public/session', { participantCode });
    setPersistentPublicToken(response.data.token);
    return response.data;
  },
  async updateResearchConsent(researchConsent: boolean) {
    return api.patch('/api/public/research-consent', { researchConsent });
  }
};
