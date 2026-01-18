import { type ConfirmChannel } from "amqplib";

import { Acks, type AckType } from "../../internal/pubsub/helpers.js";
import { publishJSON } from "../../internal/pubsub/publish.js";
import { GameState, type PlayingState } from "../../internal/gamelogic/gamestate.js";
import { handlePause } from "../../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../../internal/gamelogic/war.js";
import { MoveOutcome, handleMove } from "../../internal/gamelogic/move.js";
import { ExchangePerilTopic } from "../../internal/routing/routing.js";
import type { ArmyMove, RecognitionOfWar } from "../../internal/gamelogic/gamedata.js";
import { WarRecognitionsPrefix } from "../../internal/routing/routing.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return Acks.Ack;
  };
}

export function handlerMove(
  gs: GameState,
  channel: ConfirmChannel,
  username: string
): (move: ArmyMove) => Promise<AckType> {
  return async (move: ArmyMove): Promise<AckType> => {
    const moveOutcome = handleMove(gs, move);
    process.stdout.write("> ");
    switch (moveOutcome) {
      case MoveOutcome.MakeWar:
        const recognition = {
          attacker: move.player,
          defender: gs.getPlayerSnap(),
        };
        try {
          await publishJSON(channel, ExchangePerilTopic, `${WarRecognitionsPrefix}.${username}`, recognition);
        } catch (error) {
          return Acks.NackRequeue;
        }
        return Acks.Ack;
      case MoveOutcome.Safe:
        return Acks.Ack;
      default:
        return Acks.NackDiscard;
    }
  };
}

export function handlerWar(gs: GameState): (war: RecognitionOfWar) => Promise<AckType> {
  return async (war: RecognitionOfWar): Promise<AckType> => {
    try {
      const outcome = handleWar(gs, war);
      console.log("outcome", outcome);
      switch (outcome.result) {
        case WarOutcome.NotInvolved:
          console.log("not involved");
          return Acks.NackRequeue;
        case WarOutcome.NoUnits:
          return Acks.NackDiscard;
        case WarOutcome.YouWon:
        case WarOutcome.OpponentWon:
        case WarOutcome.Draw:
          return Acks.Ack;
        default:
          const unreachable: never = outcome;
          console.log("Unexpected war resolution: ", unreachable);
          return Acks.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}
