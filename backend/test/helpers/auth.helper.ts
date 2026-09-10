import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export type RegisterBody = {
  phone: string;
  password: string;
  displayName?: string;
  role?: string;
};

let phoneSeq = 0;

export function uniquePhone(): string {
  phoneSeq += 1;
  const base = (Date.now() % 100000000) + phoneSeq;
  return `09${String(base).padStart(9, '0').slice(-9)}`;
}

/** Parse a single cookie value from Set-Cookie header array. */
export function cookieValue(
  setCookie: string[] | string | undefined,
  name: string,
): string | undefined {
  if (!setCookie) return undefined;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of list) {
    const first = raw.split(';')[0] || '';
    const idx = first.indexOf('=');
    if (idx === -1) continue;
    const key = first.slice(0, idx).trim();
    if (key !== name) continue;
    const val = first.slice(idx + 1).trim();
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  }
  return undefined;
}

export function cookieHeader(
  setCookie: string[] | string | undefined,
  name: string,
): string | undefined {
  const val = cookieValue(setCookie, name);
  if (!val) return undefined;
  return `${name}=${encodeURIComponent(val)}`;
}

export async function register(app: INestApplication, body: RegisterBody) {
  return request(app.getHttpServer()).post('/api/v1/auth/register').send(body);
}

export async function login(
  app: INestApplication,
  phone: string,
  password: string,
  accountType: 'customer' | 'professional' = 'customer',
) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ phone, password, accountType });
}

export async function me(app: INestApplication, accessToken: string) {
  return request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${accessToken}`);
}

/** Legacy body-based refresh (dev / fallback). */
export async function refresh(app: INestApplication, refreshToken: string) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ refreshToken });
}

/** Cookie-only refresh (production path). */
export async function refreshWithCookie(
  app: INestApplication,
  cookie: string,
) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .set('Cookie', cookie)
    .send({});
}

export async function logout(app: INestApplication, refreshToken: string) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .send({ refreshToken });
}

export async function logoutWithCookie(
  app: INestApplication,
  cookie: string,
) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .set('Cookie', cookie)
    .send({});
}
