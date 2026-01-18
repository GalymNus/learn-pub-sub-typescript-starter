import amqp, { type Channel, type ChannelModel, type ConfirmChannel, type Replies } from "amqplib";

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

export enum Acks {
  "Ack",
  "NackRequeue",
  "NackDiscard",
}

export type AckType = Acks.Ack | Acks.NackRequeue | Acks.NackDiscard;

export async function subscribe<T>(
  connection: ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T
): Promise<void> {
  const [channel, queue] = await declareAndBind(connection, exchange, queueName, routingKey, simpleQueueType);
  await channel.consume(
    queue.queue,
    async (msg: amqp.ConsumeMessage | null) => {
      if (msg == null) {
        return;
      }
      let data: T;
      try {
        data = unmarshaller(msg.content);
      } catch (err) {
        console.error("Could not decode message:", err);
        return;
      }
      try {
        const handlerAckType = await handler(data);
        switch (handlerAckType) {
          case Acks.Ack:
            channel.ack(msg);
            break;
          case Acks.NackRequeue:
            channel.nack(msg, false, true);
            break;
          case Acks.NackDiscard:
          default:
            channel.nack(msg, false, false);
            break;
        }
      } catch (err) {
        console.error("Error in handler:", err);
        channel.nack(msg, false, false);
      }
    },
    {
      noAck: false,
    }
  );
}

export async function declareAndBind(
  conn: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType
): Promise<[Channel, Replies.AssertQueue]> {
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
