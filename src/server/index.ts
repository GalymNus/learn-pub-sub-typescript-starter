import amqp from "amqplib";
import { publishJSON, declareAndBind, SimpleQueueType, UserCommands } from "../internal/pubsub/helpers.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  console.log("Starting Peril server...");
  const connectionString = "amqp://guest:guest@localhost:5672/";
  const connection = await amqp.connect(connectionString);
  console.log("Created connection");
  const channel = await connection.createConfirmChannel()
  await declareAndBind(connection, ExchangePerilTopic, GameLogSlug, `${GameLogSlug}.*`, SimpleQueueType.Durable);
  printServerHelp();
  while (true) {
    const words = await getInput();
    if (words.length < 1) {
      continue;
    } else {
      if (words[0] == UserCommands.PauseKey) {
        console.log("Game is paused");
        const gameState: PlayingState = { isPaused: true };
        await publishJSON(channel, ExchangePerilDirect, UserCommands.PauseKey, gameState);
        continue;
      }
      if (words[0] == UserCommands.ResumeKey) {
        console.log("Game is resumed");
        const gameState: PlayingState = { isPaused: false };
        await publishJSON(channel, ExchangePerilDirect, UserCommands.PauseKey, gameState);
        continue;
      }
      if (words[0] == UserCommands.Quit) {
        console.log("Game is closing");
        break;
      }
      console.log("Unknown command");
    }
  }
  process.on("SIGINT", async () => {
    console.log("Game is shutting down");
    await connection.close();
    process.exit();
  })
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

