# Vix Ad Bot — Standalone

Simple Discord ad bot. No build step, no web dashboard — just Node.js.

## Deploy on justrunmyapp.com

1. Upload this **`bot-standalone`** folder (not the whole project)
2. Set this environment variable when prompted:
   - `DISCORD_BOT_TOKEN` — your bot token from the Discord Developer Portal
3. Start command: `npm start`

## Slash Commands

All commands require **Manage Server** permission except `/ad-status`.

| Command | What it does |
|---|---|
| `/ad-set-channel #channel` | Pick which channel to send ads to |
| `/ad-set-message Your text here` | Set the ad message (Discord markdown supported) |
| `/ad-set-interval 60` | How often to post ads (minimum 60 minutes) |
| `/ad-start` | Start the automated ad schedule |
| `/ad-stop` | Stop sending ads |
| `/ad-send-now` | Post the ad immediately |
| `/ad-status` | Show current settings |

## Notes

- Config resets on restart (no database). Set up your channel/message/interval again after each restart.
- The bot must be re-invited with the `applications.commands` scope for slash commands to work.
  Invite URL format: `https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=117760&scope=bot%20applications.commands`
