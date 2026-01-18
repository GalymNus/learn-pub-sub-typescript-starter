import { type ChannelModel } from "amqplib";
import { SimpleQueueType, type AckType } from "../../internal/pubsub/helpers.js";
import { decode } from "@msgpack/msgpack";
import { subscribe } from "../../internal/pubsub/helpers.js";

export async function subscribeMsgPack<T>(
  connection: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType
) {
  await subscribe(connection, exchange, queueName, key, queueType, handler, (data: Buffer) => decode(data) as T);
}

export async function subscribeJSON<T>(
  connection: ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType
): Promise<void> {
  return subscribe(connection, exchange, queueName, key, queueType, handler, (data) => JSON.parse(data.toString()));
}
