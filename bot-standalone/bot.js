import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
} from "discord.js";

// ─── Config ────────────────────────────────────────────────────────────────

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("[ERROR] DISCORD_BOT_TOKEN is not set. Add it as an environment variable.");
  process.exit(1);
}

const MIN_INTERVAL_MINUTES = 60;

// In-memory state (resets on restart — use a DB for persistence)
let config = {
  message: "# Shop Now!\nCheck out our latest deals — don't miss out!",
  channelId: "",
  intervalMinutes: 60,
  enabled: false,
};

let adTimer = null;
let storedClient = null;

// ─── Slash Commands ─────────────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("ad-set-message")
    .setDescription("Set the ad message (supports Discord markdown)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName("message").setDescription("The ad message text").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ad-set-channel")
    .setDescription("Set the text channel where ads will be sent")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("The text channel to send ads to")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName("ad-set-interval")
    .setDescription(`Set how often ads are sent (minimum ${MIN_INTERVAL_MINUTES} minutes)`)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription(`Interval in minutes (minimum ${MIN_INTERVAL_MINUTES})`)
        .setRequired(true)
        .setMinValue(MIN_INTERVAL_MINUTES)
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

// ─── Timer ──────────────────────────────────────────────────────────────────

function startAdTimer() {
  if (adTimer) clearInterval(adTimer);
  if (!config.enabled || !config.channelId) return;

  const ms = config.intervalMinutes * 60 * 1000;
  adTimer = setInterval(async () => {
    if (!config.enabled || !config.channelId || !storedClient) return;
    try {
      const channel = await storedClient.channels.fetch(config.channelId);
      if (channel && channel.type === ChannelType.GuildText) {
        await channel.send(config.message);
        console.log(`[INFO] Ad sent to channel ${config.channelId}`);
      }
    } catch (err) {
      console.error("[ERROR] Failed to send ad:", err.message);
    }
  }, ms);
  console.log(`[INFO] Ad timer started — every ${config.intervalMinutes} minutes`);
}

function stopAdTimer() {
  if (adTimer) {
    clearInterval(adTimer);
    adTimer = null;
    console.log("[INFO] Ad timer stopped");
  }
}

// ─── Command Handler ─────────────────────────────────────────────────────────

async function handleCommand(interaction) {
  const { commandName } = interaction;
  console.log(`[INFO] Slash command received: /${commandName}`);

  if (commandName === "ad-set-message") {
    const message = interaction.options.getString("message", true);
    config = { ...config, message };
    await interaction.reply({ content: `Ad message updated!\n\nPreview:\n${message}`, ephemeral: true });

  } else if (commandName === "ad-set-channel") {
    const channel = interaction.options.getChannel("channel", true);
    if (channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: "Please select a text channel.", ephemeral: true });
      return;
    }
    config = { ...config, channelId: channel.id };
    await interaction.reply({ content: `Ads will be sent to <#${channel.id}>`, ephemeral: true });

  } else if (commandName === "ad-set-interval") {
    const minutes = interaction.options.getInteger("minutes", true);
    if (minutes < MIN_INTERVAL_MINUTES) {
      await interaction.reply({ content: `Interval must be at least **${MIN_INTERVAL_MINUTES} minutes**.`, ephemeral: true });
      return;
    }
    config = { ...config, intervalMinutes: minutes };
    if (config.enabled) startAdTimer();
    await interaction.reply({
      content: `Interval set to **${minutes} minutes**. ${config.enabled ? "Timer restarted." : "Start ads with /ad-start."}`,
      ephemeral: true,
    });

  } else if (commandName === "ad-start") {
    if (!config.channelId) {
      await interaction.reply({ content: "Set a channel first with `/ad-set-channel`.", ephemeral: true });
      return;
    }
    config = { ...config, enabled: true };
    startAdTimer();
    await interaction.reply({
      content: `Ads started! Sending every **${config.intervalMinutes} minutes** to <#${config.channelId}>`,
      ephemeral: true,
    });

  } else if (commandName === "ad-stop") {
    config = { ...config, enabled: false };
    stopAdTimer();
    await interaction.reply({ content: "Ads stopped.", ephemeral: true });

  } else if (commandName === "ad-send-now") {
    if (!config.channelId) {
      await interaction.reply({ content: "Set a channel first with `/ad-set-channel`.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = await storedClient.channels.fetch(config.channelId);
      if (channel && channel.type === ChannelType.GuildText) {
        await channel.send(config.message);
        await interaction.editReply(`Ad sent to <#${config.channelId}>!`);
      } else {
        await interaction.editReply("Could not find the configured channel. Make sure the bot has access.");
      }
    } catch (err) {
      console.error("[ERROR] Failed to send ad now:", err.message);
      await interaction.editReply("Failed to send ad. Check bot permissions in that channel.");
    }

  } else if (commandName === "ad-status") {
    const statusText = config.enabled ? "ON" : "OFF";
    const channelText = config.channelId ? `<#${config.channelId}>` : "_Not set_";
    await interaction.reply({
      content: [
        `**Ad Bot — ${statusText}**`,
        ``,
        `**Channel:** ${channelText}`,
        `**Interval:** ${config.intervalMinutes} minutes`,
        `**Message:**\n\`\`\`\n${config.message.slice(0, 500)}\n\`\`\``,
      ].join("\n"),
      ephemeral: true,
    });

  } else {
    await interaction.reply({ content: `Unknown command: \`${commandName}\``, ephemeral: true });
  }
}

// ─── Bot Startup ─────────────────────────────────────────────────────────────

let isShuttingDown = false;
let reconnectTimer = null;
let reconnectAttempt = 0;

async function connect(attempt) {
  console.log(`[INFO] Connecting to Discord (attempt ${attempt})...`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const rest = new REST({ version: "10" }).setToken(token);

  client.once(Events.ClientReady, async (c) => {
    storedClient = client;
    reconnectAttempt = 0;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    console.log(`[INFO] Logged in as ${c.user.tag} — in ${c.guilds.cache.size} server(s)`);

    // Register slash commands for every guild
    const body = commands.map((cmd) => cmd.toJSON());
    for (const guild of c.guilds.cache.values()) {
      try {
        await rest.put(Routes.applicationGuildCommands(c.user.id, guild.id), { body });
        console.log(`[INFO] Commands registered in: ${guild.name}`);
      } catch (err) {
        console.error(`[ERROR] Failed to register commands in ${guild.name}:`, err.message);
      }
    }

    // Resume ad timer if it was running
    if (config.enabled && config.channelId) {
      startAdTimer();
      console.log("[INFO] Ad timer resumed after reconnect");
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    const appId = client.user?.id;
    if (!appId) return;
    const body = commands.map((cmd) => cmd.toJSON());
    try {
      await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body });
      console.log(`[INFO] Commands registered in new guild: ${guild.name}`);
    } catch (err) {
      console.error(`[ERROR] Failed to register commands in ${guild.name}:`, err.message);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleCommand(interaction);
    } catch (err) {
      console.error(`[ERROR] Command error (${interaction.commandName}):`, err.message);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "Something went wrong.", ephemeral: true });
        }
      } catch {}
    }
  });

  client.on(Events.ShardDisconnect, () => {
    console.warn("[WARN] Bot disconnected");
    scheduleReconnect(attempt + 1);
  });

  client.on(Events.Error, (err) => {
    console.error("[ERROR] Discord client error:", err.message);
  });

  try {
    await client.login(token);
  } catch (err) {
    console.error(`[ERROR] Login failed:`, err.message);
    scheduleReconnect(attempt + 1);
  }
}

function scheduleReconnect(attempt) {
  if (isShuttingDown) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60_000);
  console.log(`[INFO] Reconnecting in ${delay / 1000}s (attempt ${attempt})...`);
  reconnectTimer = setTimeout(() => connect(attempt), delay);
}

process.once("SIGTERM", () => { isShuttingDown = true; });
process.once("SIGINT", () => { isShuttingDown = true; process.exit(0); });

connect(1);
