import { userAuthCache } from '../../src/auth/user-auth-cache';

describe('userAuthCache (unit)', () => {
  afterEach(() => {
    userAuthCache.clear();
  });

  it('stores and returns cached user within TTL', () => {
    const user = {
      id: 'u1',
      phone: '09120000001',
      roles: ['customer'],
      permissions: [] as string[],
      profile: null,
      professionalId: null,
      professionalStatus: null,
    };
    userAuthCache.set('u1', user);
    const hit = userAuthCache.get('u1');
    expect(hit?.id).toBe('u1');
    expect(hit?.roles).toEqual(['customer']);
  });

  it('invalidate removes entry', () => {
    userAuthCache.set('u2', {
      id: 'u2',
      phone: null,
      roles: [],
      permissions: [],
      profile: null,
      professionalId: null,
      professionalStatus: null,
    });
    userAuthCache.invalidate('u2');
    expect(userAuthCache.get('u2')).toBeUndefined();
  });
});
