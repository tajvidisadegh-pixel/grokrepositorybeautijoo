export async function deleteMyMedia(id: string) {
  return apiClient.delete(`/professionals/me/media/${id}`);
}
