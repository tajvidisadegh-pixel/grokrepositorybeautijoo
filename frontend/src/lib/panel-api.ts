PLACEHOLDER

/* ── Account settings (issue #10) ── */
export type SessionItem = { id: string; createdAt: string; expiresAt: string };

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiClient.post<{ message: string }>('/auth/change-password', payload);
}

export async function listSessions() {
  return apiClient.get<SessionItem[]>('/auth/sessions');
}

export async function revokeSession(id: string) {
  return apiClient.delete<{ message: string }>(`/auth/sessions/${id}`);
}

export async function revokeAllSessions() {
  return apiClient.post<{ message: string }>('/auth/sessions/revoke-all', {});
}

export async function deleteAccount(payload: { password: string }) {
  return apiClient.post<{ message: string }>('/auth/delete-account', payload);
}
