/**
 * Financial Calculation & Deterministic Rounding Helpers for Beautijoo
 * 
 * Rules:
 * - Gross Amount = Payment.amount (Toman, Integer)
 * - Platform Commission Rate = e.g. 10.00 (%)
 * - Platform Commission Amount = Math.round(Gross Amount * Rate / 100) (Toman, Integer)
 * - Professional Net Amount = Gross Amount - Platform Commission Amount (Toman, Integer)
 * - Deterministic, centralized rounding in Backend (Standard Math.round to nearest Toman)
 */

export const DEFAULT_PLATFORM_COMMISSION_RATE = 10.0;
export const PLATFORM_COMMISSION_RATE_KEY = 'platform_commission_rate';

export interface CommissionCalculationResult {
  commissionRate: number;
  commissionAmount: number;
  professionalNetAmount: number;
}

export function calculateCommission(
  grossAmount: number,
  commissionRate: number,
): CommissionCalculationResult {
  // Validate rate bounds 0 <= rate <= 100
  const normalizedRate = Math.max(0, Math.min(100, Number(commissionRate)));
  // Deterministic Rounding: Math.round to integer Toman
  const commissionAmount = Math.round((grossAmount * normalizedRate) / 100);
  const professionalNetAmount = grossAmount - commissionAmount;

  return {
    commissionRate: normalizedRate,
    commissionAmount,
    professionalNetAmount,
  };
}
