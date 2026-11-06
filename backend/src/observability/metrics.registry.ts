import { Injectable } from '@nestjs/common';

export type MetricsSnapshot = {
  httpRequestsTotal: number;
  httpErrorsTotal: number;
  httpDurationMsSum: number;
  httpDurationMsCount: number;
  bookingsCreatedTotal: number;
  otpRequestsTotal: number;
  startedAt: string;
};

/**
 * Process-local counters. Not a replacement for Prometheus — baseline only.
 * Safe no-op if never injected; does not affect business paths beyond optional calls.
 */
@Injectable()
export class MetricsRegistry {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;
  private httpDurationMsSum = 0;
  private httpDurationMsCount = 0;
  private bookingsCreatedTotal = 0;
  private otpRequestsTotal = 0;
  private readonly startedAt = new Date().toISOString();

  recordHttp(statusCode: number, durationMs: number) {
    this.httpRequestsTotal += 1;
    this.httpDurationMsSum += durationMs;
    this.httpDurationMsCount += 1;
    if (statusCode >= 500) this.httpErrorsTotal += 1;
  }

  /** Optional: call from bookings create path later — public API for incremental adoption */
  incBookingsCreated() {
    this.bookingsCreatedTotal += 1;
  }

  /** Optional: call from OTP send path later */
  incOtpRequests() {
    this.otpRequestsTotal += 1;
  }

  snapshot(): MetricsSnapshot {
    return {
      httpRequestsTotal: this.httpRequestsTotal,
      httpErrorsTotal: this.httpErrorsTotal,
      httpDurationMsSum: this.httpDurationMsSum,
      httpDurationMsCount: this.httpDurationMsCount,
      bookingsCreatedTotal: this.bookingsCreatedTotal,
      otpRequestsTotal: this.otpRequestsTotal,
      startedAt: this.startedAt,
    };
  }
}
