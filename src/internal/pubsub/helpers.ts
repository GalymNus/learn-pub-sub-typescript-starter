import amqp, { type Channel, type ConfirmChannel } from "amqplib";
import { GameState } from "../gamelogic/gamestate.js";

export enum UserCommands {
  PauseKey = "pause",
  ResumeKey = "resume",
  Quit = "quit",
  Spawn = "spawn",
  Status = "status",
  Help = "Help",
  Move = "move",
  Spam = "spam",
}

export enum SimpleQueueType {
  "Durable",
  "Transient",
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const options = {
    durable: queueType == SimpleQueueType.Durable,
    autoDelete: queueType == SimpleQueueType.Transient,
    exclusive: queueType == SimpleQueueType.Transient,
    arguments: {
      "x-dead-letter-exchange": "peril_dlx",
    },
  };
  const channel = await conn.createChannel();
  const queue = await channel.assertQueue(queueName, options);
  await channel.bindQueue(queue.queue, exchange, key);
  return [channel, queue];
}

export enum Acks {
  "Ack",
  "NackRequeue",
  "NackDiscard",
}

export type AckType = Acks.Ack | Acks.NackRequeue | Acks.NackDiscard;

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType
): Promise<void> {
  const [channel, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
  await channel.consume(
    queue.queue,
    (msg: amqp.ConsumeMessage | null) => {
      if (msg == null) {
        return;
      }
      const msgString = msg.content.toString();
      const messageBody = JSON.parse(msgString);
      const handlerAckType = handler(messageBody as T);
      switch (handlerAckType) {
        case Acks.Ack:
          channel.ack(msg);
          break;
        case Acks.NackRequeue:
          channel.nack(msg, false, true);
          break;
        case Acks.NackDiscard:
          channel.nack(msg, false, false);
          break;
      }
    },
    { noAck: false }
  );
}
