import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  ChatInputCommandInteraction,
  Guild,
} from "discord.js";
import { commands, handleCommand, stopAdTimer, startAdTimer } from "./commands.js";
import { setStoredClient, getStoredClient, getConfig, setBotClientId } from "./store.js";
import { logger } from "../lib/logger.js";

let botOnline = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;

export function getBotOnline(): boolean {
  return botOnline;
}

export function getBotClient(): Client | null {
  return getStoredClient();
}

async function registerCommandsForGuild(rest: REST, appId: string, guild: Guild) {
  try {
    const body = commands.map((cmd) => cmd.toJSON());
    await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body });
    logger.info({ guildId: guild.id, guildName: guild.name }, "Slash commands registered for guild");
  } catch (err) {
    logger.error({ err, guildId: guild.id }, "Failed to register commands for guild");
  }
}

async function createAndConnectClient(token: string, attempt: number): Promise<void> {
  // Destroy any previous client cleanly
  const existing = getStoredClient();
  if (existing) {
    try { existing.destroy(); } catch {}
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    // discord.js handles gateway reconnects automatically
  });

  const rest = new REST({ version: "10" }).setToken(token);

  client.once(Events.ClientReady, async (c) => {
    botOnline = true;
    setStoredClient(client);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    setBotClientId(c.user.id);
    logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size, clientId: c.user.id }, "Discord bot logged in");

    for (const guild of c.guilds.cache.values()) {
      await registerCommandsForGuild(rest, c.user.id, guild);
    }

    // Resume ad timer if it was running before a reconnect
    const cfg = getConfig();
    if (cfg.enabled && cfg.channelId) {
      startAdTimer();
      logger.info("Ad timer resumed after reconnect");
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    const appId = client.user?.id;
    if (!appId) return;
    await registerCommandsForGuild(rest, appId, guild);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    logger.info({ type: interaction.type, isCommand: interaction.isChatInputCommand() }, "Interaction received");
    if (!interaction.isChatInputCommand()) return;
    const name = interaction.commandName;
    logger.info({ commandName: name }, "Slash command received");
    try {
      await handleCommand(interaction as ChatInputCommandInteraction);
    } catch (err) {
      logger.error({ err, commandName: name }, "Error handling command");
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "Something went wrong processing that command.", ephemeral: true });
        }
      } catch {}
    }
  });

  client.on(Events.ShardDisconnect, (_event, shardId) => {
    logger.warn({ shardId }, "Bot shard disconnected — discord.js will attempt to reconnect");
    botOnline = false;
  });

  client.on(Events.ShardReconnecting, (shardId) => {
    logger.info({ shardId }, "Bot shard reconnecting...");
  });

  client.on(Events.ShardResume, (shardId) => {
    logger.info({ shardId }, "Bot shard resumed");
    botOnline = true;
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "Discord client error");
  });


  try {
    await client.login(token);
  } catch (err) {
    logger.error({ err, attempt }, "Failed to login to Discord");
    botOnline = false;
    scheduleReconnect(token, attempt);
  }
}

function scheduleReconnect(token: string, attempt: number) {
  if (isShuttingDown) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  // Exponential backoff: 5s, 10s, 20s, 40s, capped at 60s
  const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60_000);
  logger.info({ delayMs: delay, attempt }, "Scheduling bot reconnect");

  reconnectTimer = setTimeout(async () => {
    logger.info({ attempt }, "Attempting bot reconnect");
    await createAndConnectClient(token, attempt + 1);
  }, delay);
}

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }

  isShuttingDown = false;
  await createAndConnectClient(token, 1);
}

// Graceful shutdown — don't reconnect if the process is exiting
process.once("SIGTERM", () => { isShuttingDown = true; });
process.once("SIGINT", () => { isShuttingDown = true; });
