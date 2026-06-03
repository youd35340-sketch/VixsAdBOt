import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index";

startBot().catch((err) => logger.error({ err }, "Bot startup failed"));

const rawPort = process.env["PORT"];

if (!rawPort) {
  logger.info("No PORT set — running in bot-only mode (no web dashboard)");
} else {
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    logger.error({ rawPort }, "Invalid PORT value — skipping web server");
  } else {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  }
}
