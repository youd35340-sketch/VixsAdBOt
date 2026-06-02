import type { Client } from "discord.js";

export interface AdConfig {
  message: string;
  channelId: string;
  intervalMinutes: number;
  enabled: boolean;
}

const defaultConfig: AdConfig = {
  message: "# Shop Now!\nCheck out our latest deals — don't miss out!",
  channelId: "",
  intervalMinutes: 60,
  enabled: false,
};

let config: AdConfig = { ...defaultConfig };
let timer: ReturnType<typeof setInterval> | null = null;
let discordClient: Client | null = null;

export function getConfig(): AdConfig {
  return { ...config };
}

export function setConfig(partial: Partial<AdConfig>): AdConfig {
  config = { ...config, ...partial };
  return { ...config };
}

export function getTimer(): ReturnType<typeof setInterval> | null {
  return timer;
}

export function setTimer(t: ReturnType<typeof setInterval> | null): void {
  timer = t;
}

export function getStoredClient(): Client | null {
  return discordClient;
}

export function setStoredClient(client: Client): void {
  discordClient = client;
}
