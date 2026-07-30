import type { RiskLevel } from './types';

export type FraudAssessmentInput = {
  amount: number;
  clientIp?: string | null;
  userAgent?: string | null;
  recentFailureCount?: number;
  metadata?: Record<string, unknown>;
};

export type FraudAssessment = {
  score: number;
  riskLevel: RiskLevel;
  flags: string[];
  blocked: boolean;
};

/**
 * Lightweight client-side fraud heuristics.
 * Server-side create_payment RPC applies the authoritative score.
 */
export function assessPaymentFraud(input: FraudAssessmentInput): FraudAssessment {
  let score = 0;
  const flags: string[] = [];

  if (input.amount >= 500000) {
    score += 40;
    flags.push('high_amount');
  } else if (input.amount >= 100000) {
    score += 20;
    flags.push('elevated_amount');
  }

  if (!input.clientIp) {
    score += 5;
    flags.push('missing_ip');
  }

  if (!input.userAgent) {
    score += 5;
    flags.push('missing_user_agent');
  }

  if ((input.recentFailureCount ?? 0) >= 5) {
    score += 25;
    flags.push('recent_failures');
  }

  if (input.metadata && input.metadata.force_block === true) {
    score += 100;
    flags.push('force_block');
  }

  const riskLevel: RiskLevel =
    score >= 70 ? 'blocked' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';

  return {
    score,
    riskLevel,
    flags,
    blocked: riskLevel === 'blocked',
  };
}
