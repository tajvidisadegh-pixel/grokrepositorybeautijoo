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

export async function refresh(app: INestApplication, refreshToken: string) {
  return request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken });
}

export async function logout(app: INestApplication, refreshToken: string) {
  return request(app.getHttpServer()).post('/api/v1/auth/logout').send({ refreshToken });
}
