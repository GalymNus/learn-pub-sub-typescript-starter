import amqp, { type ConfirmChannel } from "amqplib";

import {
  clientWelcome,
  commandStatus,
  getInput,
  getMaliciousLog,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType, UserCommands } from "../internal/pubsub/helpers.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import { subscribeMsgPack, subscribeJSON } from "../internal/pubsub/consume.js";
import {
  ExchangePerilDirect,
  ArmyMovesPrefix,
  PauseKey,
  ExchangePerilTopic,
  GameLogSlug,
} from "../internal/routing/routing.js";
import { GameState, type PlayingState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import { WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { handlerPause, handlerMove, handlerWar, handlerLog } from "../internal/pubsub/handlers.js";
import { type GameLog } from "../internal/gamelogic/logs.js";
import { isNumberObject } from "util/types";

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
    `${PauseKey}.${username}`,
    UserCommands.PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gameState),
  );
  await subscribeJSON<ArmyMove>(
    connection,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${username}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(gameState, channel, username),
  );
  await subscribeJSON<RecognitionOfWar>(
    connection,
    ExchangePerilTopic,
    WarRecognitionsPrefix,
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gameState, channel),
  );
  await subscribeMsgPack(
    connection,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
    handlerLog(),
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
        try {
          if (!words[1]) {
            throw new Error("Second argument is required (number from 10 to 100)");
          } else {
            const spamNumber = parseInt(words[1] || "");
            if (typeof spamNumber == "number") {
              for (let i = 0; i < spamNumber; i++) {
                const gameLog = getMaliciousLog();
                publishGameLog(channel, username, gameLog);
              }
            } else {
              throw new Error("Second argument is invalid number.");
            }
          }
        } catch (error) {
          console.log("Error:", error);
        }

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

export async function publishGameLog(channel: ConfirmChannel, username: string, message: string): Promise<void> {
  const gameLog: GameLog = { username, message, currentTime: new Date() };
  return publishMsgPack(channel, ExchangePerilTopic, `${GameLogSlug}.${username}`, gameLog);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
