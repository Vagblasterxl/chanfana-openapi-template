import type { AppContext } from "../types";

const MEM_API_URL = "https://api.mem.ai/v0/mems";

interface MemNote {
  content: string;
}

export async function pushToMem(
  apiKey: string,
  content: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch(MEM_API_URL, {
      method: "POST",
      headers: {
        Authorization: `ApiAccessToken ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Mem API ${response.status}: ${text}` };
    }

    const data = await response.json() as { id?: string };
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function formatTripleAsMemNote(
  subject: string,
  verb: string,
  object: string,
  context?: Record<string, unknown>,
  source?: string,
): string {
  const lines = [
    `# SVO Triple`,
    ``,
    `- **Subject**: ${subject}`,
    `- **Verb**: ${verb}`,
    `- **Object**: ${object}`,
  ];
  if (context && Object.keys(context).length > 0) {
    lines.push(`- **Context**: ${JSON.stringify(context)}`);
  }
  if (source) {
    lines.push(`- **Source**: ${source}`);
  }
  lines.push(`- **Logged**: ${new Date().toISOString()}`);
  lines.push(``, `#symphony #svo #knowledge`);
  return lines.join("\n");
}

export function formatAgentUpdateAsMemNote(
  agentId: string,
  action: string,
  details: string,
): string {
  return [
    `# Agent Update: ${agentId}`,
    ``,
    `**Action**: ${action}`,
    `**Details**: ${details}`,
    `**Timestamp**: ${new Date().toISOString()}`,
    ``,
    `#symphony #agent #${agentId.replace(/[^a-z0-9]/gi, "")}`,
  ].join("\n");
}

export function formatMessageAsMemNote(
  sender: string,
  recipient: string,
  messageType: string,
  payload: string,
): string {
  return [
    `# Message: ${sender} → ${recipient}`,
    ``,
    `**Type**: ${messageType}`,
    `**Payload**: ${payload}`,
    `**Timestamp**: ${new Date().toISOString()}`,
    ``,
    `#symphony #message #${sender.replace(/[^a-z0-9]/gi, "")}`,
  ].join("\n");
}
