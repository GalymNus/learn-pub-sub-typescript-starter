import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { publishJSON, declareAndBind, subscribeJSON, SimpleQueueType, UserCommands } from "../internal/pubsub/helpers.js";
import { ExchangePerilDirect, ArmyMovesPrefix, PauseKey, ExchangePerilTopic } from "../internal/routing/routing.js";
import { GameState, type PlayingState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove, handleMove } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { channel } from "diagnostics_channel";


async function main() {
  console.log("Starting Peril client...");
  const connectionString = "amqp://guest:guest@localhost:5672/";
  const connection = await amqp.connect(connectionString);
  const username = await clientWelcome();
  await declareAndBind(connection, ExchangePerilDirect, `${UserCommands.PauseKey}.${username}`, UserCommands.PauseKey, SimpleQueueType.Transient);
  console.log("Connected to server");
  const gameState = new GameState(username);
  const channel = await connection.createConfirmChannel()
  await subscribeJSON<PlayingState>(connection, ExchangePerilDirect, `${UserCommands.PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(gameState));
  await subscribeJSON<string[]>(connection, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, `${ArmyMovesPrefix}.*`, SimpleQueueType.Transient, handlerMove(gameState));
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
          commandMove(gameState, words);
          publishJSON(channel, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, words);
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
        continue;
      } else if (words[0] == UserCommands.Quit) {
        console.log("Spamming not allowed yet!");
        printQuit();
        continue;
      } else {
        console.log("Unknown command");
      }
    }
  }


  process.on("SIGINT", async () => {
    console.log("Game is shutting down");
    await connection.close();
    process.exit();
  })
}

function handlerPause(gs: GameState): (ps: PlayingState) => void {
  return (ps) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
  };
}

function handlerMove(gs: GameState): (moves: string[]) => void {
  return (moves) => {
    commandMove(gs, moves);
    process.stdout.write("> ");
  };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
