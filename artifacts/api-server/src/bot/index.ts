import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  ChatInputCommandInteraction,
} from "discord.js";
import { commands, handleCommand } from "./commands.js";
import { logger } from "../lib/logger.js";

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot logged in");

    const rest = new REST({ version: "10" }).setToken(token);
    const body = commands.map((cmd) => cmd.toJSON());

    try {
      await rest.put(Routes.applicationCommands(c.user.id), { body });
      logger.info("Slash commands registered globally");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
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
