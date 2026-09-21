
/* ── Account settings (#10) ───────────────────────────────────────── */
export type AuthSessionItem = { id: string; createdAt: string; expiresAt?: string };
export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiClient.post<{ message: string }>('/auth/change-password', payload);
}
export async function listSessions() {
  const res = await apiClient.get<{ items: AuthSessionItem[] } | AuthSessionItem[]>('/auth/sessions');
  if (Array.isArray(res)) return { items: res };
  return { items: res.items ?? [] };
}
export async function revokeSession(sessionId: string) {
  return apiClient.post<{ message: string }>(`/auth/sessions/${sessionId}/revoke`);
}
export async function revokeAllSessions() {
  return apiClient.post<{ message: string; count?: number }>('/auth/sessions/revoke-all');
}
export async function deleteAccount(password: string) {
  return apiClient.post<{ message: string }>('/auth/delete-account', { password });
}
