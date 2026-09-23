import { apiClient } from './api';
import type {
  AuthLoginResponse,
  AuthMeResponse,
  AuthRegisterResponse,
  AuthTokens,
  LoginPayload,
  OtpRequestResponse,
  RegisterPayload,
  RequestOtpPayload,
  UpdateProfilePayload,
  VerifyOtpPayload,
} from '@/types/auth';

export const authApi = {
  register(payload: RegisterPayload) {
    return apiClient.post<AuthRegisterResponse>('/auth/register', payload, {
      skipRefresh: true,
    });
  },

  login(payload: LoginPayload) {
    return apiClient.post<AuthLoginResponse>('/auth/login', payload, {
      skipRefresh: true,
    });
  },

  requestOtp(payload: RequestOtpPayload) {
    return apiClient.post<OtpRequestResponse>('/auth/otp/request', payload, {
      skipRefresh: true,
    });
  },

  verifyOtp(payload: VerifyOtpPayload) {
    return apiClient.post<AuthLoginResponse>('/auth/otp/verify', payload, {
      skipRefresh: true,
    });
  },

  /** Cookie is sent automatically (credentials: include). No body token. */
  refresh() {
    return apiClient.post<AuthTokens>('/auth/refresh', {}, { skipRefresh: true });
  },

  /** Cookie is sent automatically; backend clears httpOnly cookie. */
  logout() {
    return apiClient.post<{ message: string }>('/auth/logout', {}, {
      skipRefresh: true,
    });
  },

  me(token?: string | null) {
    return apiClient.get<AuthMeResponse>('/auth/me', {
      token: token ?? undefined,
    });
  },

  updateProfile(payload: UpdateProfilePayload) {
    return apiClient.patch<AuthMeResponse>('/auth/me', payload);
  },

  forgotPassword(payload: {
    phone: string;
    accountType?: 'customer' | 'professional';
  }) {
    return apiClient.post<{ message: string; expiresIn: number }>(
      '/auth/password/forgot',
      payload,
      { skipRefresh: true },
    );
  },

  resetPassword(payload: {
    phone: string;
    code: string;
    newPassword: string;
    accountType?: 'customer' | 'professional';
  }) {
    return apiClient.post<{ message: string }>(
      '/auth/password/reset',
      payload,
      { skipRefresh: true },
    );
  },
};
