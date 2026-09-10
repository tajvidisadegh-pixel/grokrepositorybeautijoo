import {
  allowRefreshBodyFallback,
  readRefreshFromRequest,
  REFRESH_COOKIE_NAME,
} from '../../src/auth/auth-cookies';

function mockReq(cookie?: string): any {
  return { headers: cookie ? { cookie } : {} };
}

describe('auth-cookies', () => {
  const prevBody = process.env.REFRESH_ALLOW_BODY;
  const prevEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.REFRESH_ALLOW_BODY = prevBody;
    process.env.NODE_ENV = prevEnv;
  });

  it('prefer cookie over body', () => {
    const req = mockReq(`${REFRESH_COOKIE_NAME}=from-cookie`);
    expect(
      readRefreshFromRequest(req, 'from-body', { allowBodyFallback: true }),
    ).toBe('from-cookie');
  });

  it('body fallback only when allowed', () => {
    const req = mockReq();
    expect(
      readRefreshFromRequest(req, 'from-body', { allowBodyFallback: false }),
    ).toBeUndefined();
    expect(
      readRefreshFromRequest(req, 'from-body', { allowBodyFallback: true }),
    ).toBe('from-body');
  });

  it('allowRefreshBodyFallback respects env override', () => {
    process.env.NODE_ENV = 'production';
    process.env.REFRESH_ALLOW_BODY = 'true';
    expect(allowRefreshBodyFallback()).toBe(true);
    process.env.REFRESH_ALLOW_BODY = 'false';
    expect(allowRefreshBodyFallback()).toBe(false);
    delete process.env.REFRESH_ALLOW_BODY;
    expect(allowRefreshBodyFallback()).toBe(false);
  });

  it('non-production allows body by default', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.REFRESH_ALLOW_BODY;
    expect(allowRefreshBodyFallback()).toBe(true);
  });
});
