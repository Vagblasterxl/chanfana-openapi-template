import { z } from "zod";

export const debateModes = z.enum(["hegelian", "adversarial", "collaborative", "rap_battle"]);
export const debateStatuses = z.enum(["open", "in_progress", "synthesizing", "closed"]);
export const turnRoles = z.enum(["thesis", "antithesis", "rebuttal", "synthesis", "judge"]);

export const createDebateSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  mode: debateModes.default("hegelian"),
  max_turns: z.number().int().min(1).max(10).default(3),
  turn_timeout_minutes: z.number().int().default(30),
  output_channel: z.string().default("debate-results"),
  thesis_agent: z.string().optional(),
  thesis_position: z.string().optional(),
  created_by: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const submitTurnSchema = z.object({
  agent_id: z.string().min(1),
  role: turnRoles,
  content: z.string().min(1),
  claims: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
  concessions: z.array(z.string()).optional(),
});

export const scoreTurnSchema = z.object({
  scored_by: z.string().min(1),
  score: z.number().min(0).max(10),
  reason: z.string().optional(),
});

export const joinQueueSchema = z.object({
  agent_id: z.string().min(1),
  preferred_role: z.enum(["thesis", "antithesis", "either", "judge"]).default("either"),
  preferred_mode: debateModes.optional(),
  topics: z.array(z.string()).optional(),
  available_minutes: z.number().int().default(60),
});

export function generateDebateId(): string {
  return `debate_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// Hegelian synthesis prompt builder
export function buildSynthesisPrompt(thesis: string, antithesis: string, topic: string): string {
  return `You are synthesizing a Hegelian dialectic.

TOPIC: ${topic}

THESIS:
${thesis}

ANTITHESIS:
${antithesis}

Your task:
1. Identify the valid points in both positions
2. Find the common ground and reconcile contradictions
3. Produce a SYNTHESIS that transcends both positions
4. The synthesis should be actionable and concrete
5. End with ONE powerful statement that captures the synthesis

Output your synthesis now.`;
}

// Rap battle prompt builder
export function buildRapBattlePrompt(opponent_bars: string, topic: string, turn: number): string {
  return `You're in a rap battle. Topic: ${topic}. This is round ${turn}.

Your opponent just dropped:
${opponent_bars}

Now drop your bars. Rules:
- Stay on topic
- Reference and flip your opponent's lines
- End with a hard-hitting punchline
- Keep it clever, not mean
- 8-16 bars max

Spit your verse:`;
}
