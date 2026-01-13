import amqp, { type Channel, type ConfirmChannel } from "amqplib";
import { GameState } from "../gamelogic/gamestate.js";

export async function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const jsonString = JSON.stringify(value);
  const jsonBuffer = Buffer.from(jsonString);
  await new Promise<void>((resolve, reject) => {
    ch.publish(
      exchange,
      routingKey,
      jsonBuffer,
      { contentType: "application/json" },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
  });
};

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
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const options = { durable: queueType == SimpleQueueType.Durable, autoDelete: queueType == SimpleQueueType.Transient, exclusive: queueType == SimpleQueueType.Transient }
  const channel = await conn.createChannel();
  const queue = await channel.assertQueue(queueName, options);
  await channel.bindQueue(queue.queue, exchange, key);
  return [channel, queue];
};

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => void,
): Promise<void> {
  const [channel, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
  channel.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
    if (msg == null) {
      return;
    }
    const msgString = msg.content.toString();
    const messageBody = JSON.parse(msgString);
    handler(messageBody as T);
    channel.ack(msg);
  }, { noAck: false });
}

