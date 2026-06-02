import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Client,
  TextChannel,
} from "discord.js";
import { getConfig, setConfig, getTimer, setTimer } from "./store.js";
import { logger } from "../lib/logger.js";

function startAdTimer(client: Client) {
  const existing = getTimer();
  if (existing) clearInterval(existing);

  const cfg = getConfig();
  if (!cfg.enabled || !cfg.channelId) return;

  const ms = cfg.intervalMinutes * 60 * 1000;

  const timer = setInterval(async () => {
    const current = getConfig();
    if (!current.enabled || !current.channelId) return;

    try {
      const channel = await client.channels.fetch(current.channelId);
      if (channel && channel instanceof TextChannel) {
        await channel.send(current.message);
        logger.info({ channelId: current.channelId }, "Ad sent");
      }
    } catch (err) {
      logger.error({ err }, "Failed to send ad");
    }
  }, ms);

  setTimer(timer);
  logger.info({ intervalMinutes: cfg.intervalMinutes }, "Ad timer started");
}

export function stopAdTimer() {
  const existing = getTimer();
  if (existing) {
    clearInterval(existing);
    setTimer(null);
    logger.info("Ad timer stopped");
  }
}

export const commands = [
  new SlashCommandBuilder()
    .setName("ad-set-message")
    .setDescription("Set the ad message (supports Discord markdown)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription(
          "The ad message. Use # for big headers, **bold**, @channel mentions, etc."
        )
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ad-set-channel")
    .setDescription("Set the channel where ads will be sent")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("The text channel to send ads to")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ad-set-interval")
    .setDescription("Set how often ads are sent (in minutes, default 60)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Interval in minutes (minimum 1)")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("ad-start")
    .setDescription("Start sending ads automatically")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("ad-stop")
    .setDescription("Stop sending ads")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("ad-send-now")
    .setDescription("Send the ad immediately to the configured channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("ad-status")
    .setDescription("Show current ad configuration and status"),
];

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
) {
  const { commandName } = interaction;

  if (commandName === "ad-set-message") {
    const message = interaction.options.getString("message", true);
    setConfig({ message });
    await interaction.reply({
      content: `✅ Ad message updated!\n\n**Preview:**\n${message}`,
      ephemeral: true,
    });
  } else if (commandName === "ad-set-channel") {
    const channel = interaction.options.getChannel("channel", true);
    if (!(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "❌ Please select a text channel.",
        ephemeral: true,
      });
      return;
    }
    setConfig({ channelId: channel.id });
    await interaction.reply({
      content: `✅ Ads will be sent to <#${channel.id}>`,
      ephemeral: true,
    });
  } else if (commandName === "ad-set-interval") {
    const minutes = interaction.options.getInteger("minutes", true);
    setConfig({ intervalMinutes: minutes });
    const cfg = getConfig();
    if (cfg.enabled) {
      startAdTimer(client);
    }
    await interaction.reply({
      content: `✅ Ad interval set to **${minutes} minute${minutes === 1 ? "" : "s"}**. ${cfg.enabled ? "Timer restarted." : "Start ads with /ad-start."}`,
      ephemeral: true,
    });
  } else if (commandName === "ad-start") {
    const cfg = getConfig();
    if (!cfg.channelId) {
      await interaction.reply({
        content: "❌ Set a channel first with `/ad-set-channel`.",
        ephemeral: true,
      });
      return;
    }
    setConfig({ enabled: true });
    startAdTimer(client);
    await interaction.reply({
      content: `✅ Ads started! Sending every **${cfg.intervalMinutes} minute${cfg.intervalMinutes === 1 ? "" : "s"}** to <#${cfg.channelId}>`,
      ephemeral: true,
    });
  } else if (commandName === "ad-stop") {
    setConfig({ enabled: false });
    stopAdTimer();
    await interaction.reply({
      content: "🛑 Ads stopped.",
      ephemeral: true,
    });
  } else if (commandName === "ad-send-now") {
    const cfg = getConfig();
    if (!cfg.channelId) {
      await interaction.reply({
        content: "❌ Set a channel first with `/ad-set-channel`.",
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = await client.channels.fetch(cfg.channelId);
      if (channel && channel instanceof TextChannel) {
        await channel.send(cfg.message);
        await interaction.editReply(`✅ Ad sent to <#${cfg.channelId}>!`);
      } else {
        await interaction.editReply("❌ Could not find the configured channel. Make sure the bot has access.");
      }
    } catch (err) {
      logger.error({ err }, "Failed to send ad now");
      await interaction.editReply("❌ Failed to send ad. Check bot permissions.");
    }
  } else if (commandName === "ad-status") {
    const cfg = getConfig();
    const statusEmoji = cfg.enabled ? "🟢" : "🔴";
    const channelText = cfg.channelId ? `<#${cfg.channelId}>` : "_Not set_";
    const status = [
      `**Ad Bot Status** ${statusEmoji}`,
      ``,
      `**Status:** ${cfg.enabled ? "Running" : "Stopped"}`,
      `**Channel:** ${channelText}`,
      `**Interval:** ${cfg.intervalMinutes} minute${cfg.intervalMinutes === 1 ? "" : "s"}`,
      `**Message:**\n\`\`\`\n${cfg.message.slice(0, 500)}\n\`\`\``,
    ].join("\n");
    await interaction.reply({ content: status, ephemeral: true });
  }
}
