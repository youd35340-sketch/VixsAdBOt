import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  ChatInputCommandInteraction,
  Guild,
} from "discord.js";
import { commands, handleCommand } from "./commands.js";
import { logger } from "../lib/logger.js";

async function registerCommandsForGuild(
  rest: REST,
  appId: string,
  guild: Guild
) {
  try {
    const body = commands.map((cmd) => cmd.toJSON());
    await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body });
    logger.info({ guildId: guild.id, guildName: guild.name }, "Slash commands registered for guild");
  } catch (err) {
    logger.error({ err, guildId: guild.id }, "Failed to register commands for guild");
  }
}

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const rest = new REST({ version: "10" }).setToken(token);

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, "Discord bot logged in");

    for (const guild of c.guilds.cache.values()) {
      await registerCommandsForGuild(rest, c.user.id, guild);
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    const appId = client.user?.id;
    if (!appId) return;
    await registerCommandsForGuild(rest, appId, guild);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleCommand(interaction as ChatInputCommandInteraction, client);
    } catch (err) {
      logger.error({ err }, "Error handling command");
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Something went wrong.",
          ephemeral: true,
        });
      }
    }
  });

  try {
    await client.login(token);
  } catch (err) {
    logger.error({ err }, "Failed to login to Discord");
  }
}
