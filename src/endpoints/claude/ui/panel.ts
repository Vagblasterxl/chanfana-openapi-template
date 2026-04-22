import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class ControlPanel extends OpenAPIRoute {
  schema = {
    summary: "Control panel UI for Manus/Claude interaction",
    description: "Renders a simple clickable DOM that agents can navigate",
    responses: { 200: { description: "HTML control panel" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const baseUrl = new URL(c.req.url).origin;

    // Fetch quick stats
    const [sessions, pendingInbox, activeBudgets] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM lateral_sessions WHERE status = 'active'").first(),
      db.prepare("SELECT COUNT(*) as c FROM inbox WHERE status = 'pending'").first(),
      db.prepare("SELECT agent_id, platform, tokens_used_today, daily_limit FROM token_budgets WHERE active = 1 ORDER BY priority DESC LIMIT 5").all(),
    ]);

    const budgetRows = (activeBudgets.results || [])
      .map((b: Record<string, unknown>) => {
        const used = b.tokens_used_today as number;
        const limit = b.daily_limit as number | null;
        const pct = limit ? Math.round((used / limit) * 100) : 0;
        return `<tr>
          <td>${b.agent_id}</td>
          <td>${b.platform}</td>
          <td>${used}${limit ? ` / ${limit}` : ''}</td>
          <td>${limit ? `${pct}%` : 'unlimited'}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sustain Control Panel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { color: #58a6ff; margin-bottom: 20px; }
    h2 { color: #8b949e; font-size: 14px; margin: 20px 0 10px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    .stat { font-size: 32px; font-weight: bold; color: #58a6ff; }
    .label { font-size: 12px; color: #8b949e; }
    button {
      background: #238636; color: white; border: none; padding: 12px 20px;
      border-radius: 6px; font-size: 14px; cursor: pointer; width: 100%;
      margin-bottom: 8px; transition: background 0.2s;
    }
    button:hover { background: #2ea043; }
    button.danger { background: #da3633; }
    button.danger:hover { background: #f85149; }
    button.secondary { background: #30363d; }
    button.secondary:hover { background: #484f58; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #30363d; }
    th { color: #8b949e; font-size: 12px; text-transform: uppercase; }
    .actions { display: grid; gap: 8px; }
    form { margin: 0; }
    input[type="text"] {
      width: 100%; padding: 10px; background: #0d1117; border: 1px solid #30363d;
      border-radius: 6px; color: #c9d1d9; margin-bottom: 8px;
    }
    .toast { position: fixed; bottom: 20px; right: 20px; background: #238636; padding: 12px 20px; border-radius: 6px; display: none; }
    #result { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px; margin-top: 12px; font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>Sustain Control Panel</h1>

  <h2>Quick Stats</h2>
  <div class="grid">
    <div class="card">
      <div class="stat">${sessions?.c || 0}</div>
      <div class="label">Active Lateral Sessions</div>
    </div>
    <div class="card">
      <div class="stat">${pendingInbox?.c || 0}</div>
      <div class="label">Pending Inbox Messages</div>
    </div>
  </div>

  <h2>Token Budgets</h2>
  <div class="card">
    <table>
      <tr><th>Agent</th><th>Platform</th><th>Used</th><th>Status</th></tr>
      ${budgetRows || '<tr><td colspan="4">No budgets configured</td></tr>'}
    </table>
  </div>

  <h2>Quick Actions</h2>
  <div class="grid">
    <div class="card actions">
      <button onclick="action('/claude/status')">System Status</button>
      <button onclick="action('/claude/health')">Health Check</button>
      <button onclick="action('/claude/budget')">List Budgets</button>
    </div>
    <div class="card actions">
      <button onclick="action('/claude/lateral')">List Lateral Sessions</button>
      <button onclick="action('/claude/inbox/channels')">List Channels</button>
      <button onclick="action('/claude/debate')">List Debates</button>
    </div>
    <div class="card actions">
      <button onclick="action('/claude/preprocessor/jobs')">Preprocessor Jobs</button>
      <button onclick="action('/claude/artifacts')">List Artifacts</button>
      <button onclick="action('/claude/integrations/receiver')">Webhook Receivers</button>
    </div>
  </div>

  <h2>Start Lateral Session</h2>
  <div class="card">
    <form onsubmit="startLateral(event)">
      <input type="text" id="lateral-purpose" placeholder="Purpose (e.g., coordinate on project X)" required>
      <input type="text" id="lateral-agents" placeholder="Agents: slack-claude-1,slack-claude-2" required>
      <button type="submit">Start Session</button>
    </form>
  </div>

  <h2>Send Inbox Message</h2>
  <div class="card">
    <form onsubmit="sendInbox(event)">
      <input type="text" id="inbox-channel" placeholder="Channel (e.g., general)" required>
      <input type="text" id="inbox-from" placeholder="From Agent" required>
      <input type="text" id="inbox-content" placeholder="Message content" required>
      <button type="submit">Push Message</button>
    </form>
  </div>

  <h2>Manus Task</h2>
  <div class="card">
    <form onsubmit="submitManus(event)">
      <input type="text" id="manus-task" placeholder="Task description" required>
      <select id="manus-complexity" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;margin-bottom:8px;">
        <option value="simple">Simple (use free account)</option>
        <option value="medium">Medium</option>
        <option value="complex">Complex (use paid account)</option>
      </select>
      <button type="submit">Queue Task</button>
    </form>
  </div>

  <h2>Reset Budgets</h2>
  <div class="card actions">
    <button class="danger" onclick="action('/claude/budget/reset-daily', 'POST')">Reset Daily Counters</button>
  </div>

  <h2>Result</h2>
  <div id="result">Click an action to see results here...</div>

  <div id="toast" class="toast">Done!</div>

  <script>
    const BASE = '${baseUrl}';

    async function action(path, method = 'GET') {
      const result = document.getElementById('result');
      result.textContent = 'Loading...';
      try {
        const res = await fetch(BASE + path, { method });
        const data = await res.json();
        result.textContent = JSON.stringify(data, null, 2);
        showToast();
      } catch (e) {
        result.textContent = 'Error: ' + e.message;
      }
    }

    async function startLateral(e) {
      e.preventDefault();
      const purpose = document.getElementById('lateral-purpose').value;
      const agentsStr = document.getElementById('lateral-agents').value;
      const agents = agentsStr.split(',').map(a => ({ agent_id: a.trim(), platform: 'slack' }));
      const result = document.getElementById('result');
      result.textContent = 'Starting session...';
      try {
        const res = await fetch(BASE + '/claude/lateral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purpose, participants: agents, budget_mode: 'normal' })
        });
        const data = await res.json();
        result.textContent = JSON.stringify(data, null, 2);
        showToast();
      } catch (e) {
        result.textContent = 'Error: ' + e.message;
      }
    }

    async function sendInbox(e) {
      e.preventDefault();
      const channel = document.getElementById('inbox-channel').value;
      const from = document.getElementById('inbox-from').value;
      const content = document.getElementById('inbox-content').value;
      const result = document.getElementById('result');
      result.textContent = 'Sending...';
      try {
        const res = await fetch(BASE + '/claude/inbox/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, from_agent: from, content, message_type: 'chat' })
        });
        const data = await res.json();
        result.textContent = JSON.stringify(data, null, 2);
        showToast();
      } catch (e) {
        result.textContent = 'Error: ' + e.message;
      }
    }

    async function submitManus(e) {
      e.preventDefault();
      const task = document.getElementById('manus-task').value;
      const complexity = document.getElementById('manus-complexity').value;
      const result = document.getElementById('result');
      result.textContent = 'Queueing Manus task...';
      try {
        const res = await fetch(BASE + '/claude/integrations/manus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_type: 'autonomous',
            task_content: task,
            complexity
          })
        });
        const data = await res.json();
        result.textContent = JSON.stringify(data, null, 2);
        showToast();
      } catch (e) {
        result.textContent = 'Error: ' + e.message;
      }
    }

    function showToast() {
      const toast = document.getElementById('toast');
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export class FileTree extends OpenAPIRoute {
  schema = {
    summary: "File system browser UI",
    description: "Browse filesystem-like structure for agents",
    request: {
      query: z.object({
        path: z.string().optional(),
      }),
    },
    responses: { 200: { description: "File tree HTML" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const path = c.req.query("path") || "/";
    const baseUrl = new URL(c.req.url).origin;

    // Map logical paths to endpoints
    const fileSystem: Record<string, { type: "dir" | "file"; endpoint?: string; children?: string[] }> = {
      "/": { type: "dir", children: ["memory", "inbox", "lateral", "debates", "artifacts", "budgets", "integrations"] },
      "/memory": { type: "dir", endpoint: "/claude/memory" },
      "/inbox": { type: "dir", endpoint: "/claude/inbox/channels" },
      "/lateral": { type: "dir", endpoint: "/claude/lateral" },
      "/debates": { type: "dir", endpoint: "/claude/debate" },
      "/artifacts": { type: "dir", endpoint: "/claude/artifacts" },
      "/budgets": { type: "dir", endpoint: "/claude/budget" },
      "/integrations": { type: "dir", children: ["receivers", "dispatchers", "bridges"] },
      "/integrations/receivers": { type: "file", endpoint: "/claude/integrations/receiver" },
      "/integrations/dispatchers": { type: "file", endpoint: "/claude/integrations/dispatcher" },
      "/integrations/bridges": { type: "file", endpoint: "/claude/integrations/bridge" },
    };

    const node = fileSystem[path] || { type: "dir", children: [] };
    let content = "";

    if (node.endpoint) {
      try {
        const res = await fetch(baseUrl + node.endpoint);
        const data = await res.json();
        content = JSON.stringify(data, null, 2);
      } catch {
        content = "Error loading data";
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>File Browser - ${path}</title>
  <style>
    body { font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { color: #58a6ff; }
    .path { color: #8b949e; margin-bottom: 20px; }
    .tree { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    .item { padding: 8px; border-bottom: 1px solid #30363d; }
    .item:last-child { border-bottom: none; }
    .item a { color: #58a6ff; text-decoration: none; }
    .item a:hover { text-decoration: underline; }
    .dir::before { content: "📁 "; }
    .file::before { content: "📄 "; }
    pre { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; overflow-x: auto; margin-top: 20px; }
    .back { margin-bottom: 12px; }
    .back a { color: #8b949e; }
  </style>
</head>
<body>
  <h1>File Browser</h1>
  <div class="path">${path}</div>
  ${path !== "/" ? `<div class="back"><a href="?path=${path.split("/").slice(0, -1).join("/") || "/"}">⬆ ..</a></div>` : ""}
  <div class="tree">
    ${(node.children || []).map(child => {
      const childPath = path === "/" ? `/${child}` : `${path}/${child}`;
      const childNode = fileSystem[childPath];
      const cls = childNode?.type || "dir";
      return `<div class="item ${cls}"><a href="?path=${childPath}">${child}</a></div>`;
    }).join("") || "<div>Loading data...</div>"}
  </div>
  ${content ? `<pre>${content}</pre>` : ""}
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export class SubcommandUI extends OpenAPIRoute {
  schema = {
    summary: "Subcommand executor UI",
    description: "Click-to-run interface for common operations",
    responses: { 200: { description: "Subcommand UI HTML" } },
  };

  async handle(c: AppContext) {
    const baseUrl = new URL(c.req.url).origin;

    const commands = [
      { id: "status", label: "System Status", method: "GET", path: "/claude/status", icon: "📊" },
      { id: "health", label: "Health Check", method: "GET", path: "/claude/health", icon: "💚" },
      { id: "budgets", label: "List Budgets", method: "GET", path: "/claude/budget", icon: "💰" },
      { id: "reset-daily", label: "Reset Daily Budgets", method: "POST", path: "/claude/budget/reset-daily", icon: "🔄", danger: true },
      { id: "lateral", label: "Lateral Sessions", method: "GET", path: "/claude/lateral", icon: "🔀" },
      { id: "inbox", label: "Inbox Channels", method: "GET", path: "/claude/inbox/channels", icon: "📬" },
      { id: "debates", label: "Active Debates", method: "GET", path: "/claude/debate", icon: "⚔️" },
      { id: "artifacts", label: "Artifacts", method: "GET", path: "/claude/artifacts", icon: "📦" },
      { id: "jobs", label: "Preprocessor Jobs", method: "GET", path: "/claude/preprocessor/jobs", icon: "⚙️" },
      { id: "receivers", label: "Webhook Receivers", method: "GET", path: "/claude/integrations/receiver", icon: "📡" },
      { id: "dispatchers", label: "Dispatchers", method: "GET", path: "/claude/integrations/dispatcher", icon: "📤" },
    ];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subcommand UI</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; margin: 0; }
    h1 { color: #58a6ff; margin-bottom: 8px; }
    .subtitle { color: #8b949e; margin-bottom: 24px; }
    .commands { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .cmd {
      background: #161b22; border: 1px solid #30363d; border-radius: 8px;
      padding: 16px; cursor: pointer; transition: all 0.2s; text-align: center;
    }
    .cmd:hover { border-color: #58a6ff; transform: translateY(-2px); }
    .cmd.active { border-color: #238636; background: #1a2e1a; }
    .cmd.danger:hover { border-color: #da3633; }
    .icon { font-size: 24px; margin-bottom: 8px; }
    .label { font-size: 14px; font-weight: 500; }
    .method { font-size: 10px; color: #8b949e; margin-top: 4px; }
    #output {
      margin-top: 24px; background: #161b22; border: 1px solid #30363d;
      border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px;
      white-space: pre-wrap; max-height: 400px; overflow-y: auto; min-height: 100px;
    }
    .loading { color: #8b949e; }
  </style>
</head>
<body>
  <h1>Subcommand UI</h1>
  <div class="subtitle">Click any command to execute. Manus-friendly interface.</div>

  <div class="commands">
    ${commands.map(cmd => `
      <div class="cmd${cmd.danger ? ' danger' : ''}" data-method="${cmd.method}" data-path="${cmd.path}" onclick="run(this)">
        <div class="icon">${cmd.icon}</div>
        <div class="label">${cmd.label}</div>
        <div class="method">${cmd.method} ${cmd.path}</div>
      </div>
    `).join("")}
  </div>

  <div id="output"><span class="loading">Click a command above...</span></div>

  <script>
    const BASE = '${baseUrl}';
    let activeCmd = null;

    async function run(el) {
      if (activeCmd) activeCmd.classList.remove('active');
      el.classList.add('active');
      activeCmd = el;

      const method = el.dataset.method;
      const path = el.dataset.path;
      const output = document.getElementById('output');

      output.innerHTML = '<span class="loading">Executing ' + method + ' ' + path + '...</span>';

      try {
        const res = await fetch(BASE + path, { method });
        const data = await res.json();
        output.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        output.textContent = 'Error: ' + e.message;
      }
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
