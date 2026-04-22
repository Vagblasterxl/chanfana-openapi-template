import { z } from "zod";

export const platforms = z.enum(["claude", "gemma-4", "manus", "slack", "discord", "other"]);
export const budgetModes = z.enum(["cheap", "normal", "max_power"]);

export const createBudgetSchema = z.object({
  agent_id: z.string().min(1),
  platform: platforms,
  daily_limit: z.number().int().optional(),
  monthly_limit: z.number().int().optional(),
  cost_per_1k_tokens: z.number().default(0),
  priority: z.number().int().min(0).max(10).default(5),
});

export const recordUsageSchema = z.object({
  agent_id: z.string().min(1),
  platform: platforms,
  tokens_used: z.number().int().min(0),
  operation: z.string().optional(),
  reference_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createLateralSessionSchema = z.object({
  purpose: z.string().min(1),
  participants: z.array(z.object({
    agent_id: z.string(),
    platform: z.string(),
    slack_workspace: z.string().optional(),
    channel: z.string().optional(),
  })).min(2),
  coordinator_agent: z.string().optional(),
  budget_mode: budgetModes.default("normal"),
  metadata: z.record(z.unknown()).optional(),
});

export const relayLateralMessageSchema = z.object({
  from_agent: z.string().min(1),
  content: z.string().min(1),
  to_agent: z.string().optional(),              // if omitted, broadcasts to all other participants
  message_type: z.enum(["chat", "command", "result", "coordinator_note"]).default("chat"),
  use_manus: z.boolean().default(true),         // use manus coordinator for relay
});

export function generateSessionId(): string {
  return `lat_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

export function generateTaskId(): string {
  return `mtask_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

// Estimate token cost for a message
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 chars
  return Math.ceil(text.length / 4);
}

// Determine cheapest capable platform based on budget mode
export function selectPlatform(
  mode: "cheap" | "normal" | "max_power",
  availableBudgets: Array<{ platform: string; tokens_available: number; priority: number; cost_per_1k: number }>
): string | null {
  if (availableBudgets.length === 0) return null;

  const filtered = availableBudgets.filter(b => b.tokens_available > 0);
  if (filtered.length === 0) return null;

  if (mode === "cheap") {
    // Pick cheapest (lowest cost per 1k)
    return filtered.sort((a, b) => a.cost_per_1k - b.cost_per_1k)[0].platform;
  } else if (mode === "max_power") {
    // Pick highest cost (usually most capable)
    return filtered.sort((a, b) => b.cost_per_1k - a.cost_per_1k)[0].platform;
  } else {
    // Normal: balance priority and cost
    return filtered.sort((a, b) => (b.priority / (b.cost_per_1k + 0.0001)) - (a.priority / (a.cost_per_1k + 0.0001)))[0].platform;
  }
}

// Manus account selection strategy
export interface ManusAccount {
  agent_id: string;
  daily_limit: number | null;
  monthly_limit: number | null;
  tokens_used_today: number;
  tokens_used_this_month: number;
  priority: number;
}

// Pick best Manus account for a task
// Strategy: use free accounts (daily limit) for small stuff, paid (monthly) for complex tasks
export function selectManusAccount(
  accounts: ManusAccount[],
  estimatedTokens: number,
  taskComplexity: "simple" | "medium" | "complex" = "simple"
): ManusAccount | null {
  // Separate free (daily limit) from paid (monthly limit)
  const freeAccounts = accounts.filter(a => a.daily_limit !== null);
  const paidAccounts = accounts.filter(a => a.monthly_limit !== null);

  // For simple tasks (relay, quick browse), prefer free accounts
  if (taskComplexity === "simple") {
    // Find free account with enough daily budget
    const viable = freeAccounts.filter(a =>
      (a.daily_limit! - a.tokens_used_today) >= estimatedTokens
    ).sort((a, b) => b.priority - a.priority);

    if (viable.length > 0) return viable[0];
  }

  // For complex tasks or when free exhausted, use paid account
  if (taskComplexity === "complex" || freeAccounts.every(a =>
    (a.daily_limit! - a.tokens_used_today) < estimatedTokens
  )) {
    const viablePaid = paidAccounts.filter(a =>
      (a.monthly_limit! - a.tokens_used_this_month) >= estimatedTokens
    ).sort((a, b) => b.priority - a.priority);

    if (viablePaid.length > 0) return viablePaid[0];
  }

  // Fallback: any account with enough tokens
  return accounts.find(a => {
    const dailyAvail = a.daily_limit ? a.daily_limit - a.tokens_used_today : Infinity;
    const monthlyAvail = a.monthly_limit ? a.monthly_limit - a.tokens_used_this_month : Infinity;
    return Math.min(dailyAvail, monthlyAvail) >= estimatedTokens;
  }) || null;
}
