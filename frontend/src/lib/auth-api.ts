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

  refresh(refreshToken: string) {
    return apiClient.post<AuthTokens>(
      '/auth/refresh',
      { refreshToken },
      { skipRefresh: true },
    );
  },

  logout(refreshToken: string) {
    return apiClient.post<{ message: string }>(
      '/auth/logout',
      { refreshToken },
      { skipRefresh: true },
    );
  },

  me(token?: string | null) {
    return apiClient.get<AuthMeResponse>('/auth/me', {
      token: token ?? undefined,
    });
  },
};
