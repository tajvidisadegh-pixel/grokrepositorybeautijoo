/** Matches backend AuthService response shapes */

export type AuthTokens = {
  accessToken: string;
  /** Optional when refresh is httpOnly-cookie only */
  refreshToken?: string;
};

export type AuthUserSummary = {
  id: string;
  phone: string | null;
  roles?: string[];
};

export type AuthLoginResponse = AuthTokens & {
  user: AuthUserSummary;
};

export type AuthRegisterResponse = AuthTokens & {
  user: { id: string; phone: string | null; roles?: string[] };
};

export type AccountType = 'customer' | 'professional';

export type AuthMeResponse = {
  id: string;
  phone: string | null;
  email: string | null;
  status: string;
  accountType?: AccountType;
  phoneVerified: boolean;
  profile: {
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  roles: string[];
  professional: {
    id: string;
    slug: string;
    status: string;
    title?: string | null;
  } | null;
};

export type OtpRequestResponse = {
  message: string;
  expiresIn: number;
};

export type RegisterPayload = {
  phone: string;
  password: string;
  displayName?: string;
  /** Public registration: only customer | professional (backend validates) */
  role?: AccountType;
};

export type LoginPayload = {
  phone: string;
  password: string;
  /** Optional: which persona when separate accounts exist for same phone */
  accountType?: AccountType;
};

export type RequestOtpPayload = {
  phone: string;
  purpose?: string;
  accountType?: AccountType;
};

export type VerifyOtpPayload = {
  phone: string;
  code: string;
  purpose?: string;
  accountType?: AccountType;
};
