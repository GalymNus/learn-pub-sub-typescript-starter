import amqp from "amqplib";

import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, subscribeJSON, UserCommands } from "../internal/pubsub/helpers.js";
import { publishJSON } from "../internal/pubsub/publish.js";

import { ExchangePerilDirect, ArmyMovesPrefix, PauseKey, ExchangePerilTopic } from "../internal/routing/routing.js";
import { GameState, type PlayingState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import { WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { handlerPause, handlerMove, handlerWar } from "../internal/pubsub/handlers.js";

async function main() {
  console.log("Starting Peril client...");
  const connectionString = "amqp://guest:guest@localhost:5672/";
  const connection = await amqp.connect(connectionString);
  const username = await clientWelcome();
  console.log("Connected to server");
  const gameState = new GameState(username);
  const channel = await connection.createConfirmChannel();
  await subscribeJSON<PlayingState>(
    connection,
    ExchangePerilDirect,
    `${UserCommands.PauseKey}.${username}`,
    UserCommands.PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gameState)
  );
  await subscribeJSON<ArmyMove>(
    connection,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${username}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(gameState, channel, username)
  );
  await subscribeJSON<RecognitionOfWar>(
    connection,
    ExchangePerilTopic,
    WarRecognitionsPrefix,
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gameState)
  );

  while (true) {
    const words = await getInput();
    if (words.length < 1) {
      continue;
    } else {
      if (words[0] == UserCommands.Spawn) {
        commandSpawn(gameState, words);
        continue;
      } else if (words[0] == UserCommands.Move) {
        try {
          const move = commandMove(gameState, words);
          publishJSON(channel, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, move);
          console.log("Move was published successfully");
        } catch (error) {
          console.log((error as Error).message);
        }
        continue;
      } else if (words[0] == UserCommands.Status) {
        commandStatus(gameState);
        continue;
      } else if (words[0] == UserCommands.Help) {
        printClientHelp();
        continue;
      } else if (words[0] == UserCommands.Spam) {
        console.log("Spamming not allowed yet!");
      } else if (words[0] == UserCommands.Quit) {
        console.log("Spamming not allowed yet!");
        printQuit();
        break;
      } else {
        console.log("Unknown command");
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
