import { Router } from "express";
import { getConfig, setConfig, getStoredClient } from "../bot/store.js";
import { stopAdTimer, startAdTimer } from "../bot/commands.js";
import { getBotOnline } from "../bot/index.js";
import { ChannelType, TextChannel } from "discord.js";
import { logger } from "../lib/logger.js";

const router = Router();

function buildStatus() {
  const cfg = getConfig();
  return {
    online: getBotOnline(),
    enabled: cfg.enabled,
    message: cfg.message,
    channelId: cfg.channelId,
    intervalMinutes: cfg.intervalMinutes,
  };
}

router.get("/status", (_req, res) => {
  res.json(buildStatus());
});

router.post("/config", (req, res) => {
  const { message, channelId, intervalMinutes } = req.body as {
    message?: string;
    channelId?: string;
    intervalMinutes?: number;
  };

  if (intervalMinutes !== undefined && intervalMinutes < 60) {
    res.status(400).json({ error: "intervalMinutes must be at least 60" });
    return;
  }

  setConfig({
    ...(message !== undefined && { message }),
    ...(channelId !== undefined && { channelId }),
    ...(intervalMinutes !== undefined && { intervalMinutes }),
  });

  const cfg = getConfig();
  if (cfg.enabled) startAdTimer();

  res.json(buildStatus());
});

router.post("/start", (_req, res) => {
  const cfg = getConfig();
  if (!cfg.channelId) {
    res.status(400).json({ error: "Set a channel ID first" });
    return;
  }
  setConfig({ enabled: true });
  startAdTimer();
  res.json(buildStatus());
});

router.post("/stop", (_req, res) => {
  setConfig({ enabled: false });
  stopAdTimer();
  res.json(buildStatus());
});

router.post("/send-now", async (_req, res) => {
  const cfg = getConfig();
  if (!cfg.channelId) {
    res.json({ success: false, message: "No channel configured. Set a channel ID first." });
    return;
  }

  const client = getStoredClient();
  if (!client) {
    res.json({ success: false, message: "Bot is offline. Check your token and restart." });
    return;
  }

  try {
    const channel = await client.channels.fetch(cfg.channelId);
    if (channel && channel.type === ChannelType.GuildText) {
      await (channel as TextChannel).send(cfg.message);
      res.json({ success: true, message: "Ad sent successfully!" });
    } else {
      res.json({ success: false, message: "Channel not found or not a text channel." });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send ad via dashboard");
    res.json({ success: false, message: "Failed to send. Check bot permissions in that channel." });
  }
});

export default router;
