/**
 * The `/omega` command definition, in Discord's application-command shape.
 *
 * Discord does not learn a command's name or options from the interactions
 * endpoint — it has to be registered once against the application. Keeping the
 * definition next to the dispatcher means the registered surface and the
 * implemented surface cannot drift, and `GET /discord/commands` serves this
 * verbatim so it can be piped straight into Discord's API:
 *
 *   curl -X PUT \
 *     -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     --data @- \
 *     "https://discord.com/api/v10/applications/$DISCORD_APPLICATION_ID/commands" \
 *     < <(curl -s https://<worker>/discord/commands)
 */

const STRING = 3;
const INTEGER = 4;
const SUB_COMMAND = 1;

export const omegaCommand = {
  name: "omega",
  description: "Talk to the agent mesh",
  // Guild-install only: these commands act on shared state, so they are not
  // offered in arbitrary DMs.
  dm_permission: false,
  options: [
    {
      name: "status",
      description: "Bus totals and whether this account is bound",
      type: SUB_COMMAND,
    },
    {
      name: "whoami",
      description: "The agent, Polar customer, and capabilities behind this account",
      type: SUB_COMMAND,
    },
    {
      name: "send",
      description: "Queue a message for an agent",
      type: SUB_COMMAND,
      options: [
        {
          name: "recipient",
          description: "Agent id to deliver to",
          type: STRING,
          required: true,
        },
        {
          name: "message",
          description: "Message body",
          type: STRING,
          required: true,
        },
        {
          name: "type",
          description: "Message type (default discord.relay)",
          type: STRING,
          required: false,
        },
      ],
    },
    {
      name: "inbox",
      description: "Open messages for an agent (defaults to your own)",
      type: SUB_COMMAND,
      options: [
        {
          name: "recipient",
          description: "Agent id (defaults to the agent you are bound to)",
          type: STRING,
          required: false,
        },
        {
          name: "limit",
          description: "How many to show (1-25, default 5)",
          type: INTEGER,
          required: false,
        },
      ],
    },
    {
      name: "ack",
      description: "Acknowledge a message addressed to your agent",
      type: SUB_COMMAND,
      options: [
        {
          name: "id",
          description: "Bus message id",
          type: INTEGER,
          required: true,
        },
      ],
    },
    {
      name: "bind",
      description:
        "Map a Discord account to an agent and Polar customer (operator or registry.admin)",
      type: SUB_COMMAND,
      options: [
        {
          name: "agent",
          description: "Agent id to bind to",
          type: STRING,
          required: true,
        },
        {
          name: "customer",
          description:
            "Polar customer id or external id — the source of the agent's capabilities",
          type: STRING,
          required: false,
        },
        {
          name: "user",
          description: "Discord user id to bind (defaults to you)",
          type: STRING,
          required: false,
        },
        {
          name: "username",
          description: "Label for the bound account, when binding someone else",
          type: STRING,
          required: false,
        },
      ],
    },
  ],
} as const;

/** Discord's bulk-overwrite endpoint takes an array. */
export const commandManifest = [omegaCommand];
