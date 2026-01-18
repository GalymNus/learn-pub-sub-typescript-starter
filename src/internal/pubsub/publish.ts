import { type ConfirmChannel } from "amqplib";
import { encode } from "@msgpack/msgpack";

export async function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T
): Promise<void> {
  const jsonString = JSON.stringify(value);
  const jsonBuffer = Buffer.from(jsonString);
  await new Promise<void>((resolve, reject) => {
    ch.publish(exchange, routingKey, jsonBuffer, { contentType: "application/json" }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function publishMsgPack<T>(ch: ConfirmChannel, exchange: string, routingKey: string, value: T): Promise<void> {
  const encoded: Uint8Array = encode(value);
  const encodedBuffer = Buffer.from(encoded);
  ch.publish(exchange, routingKey, encodedBuffer, { contentType: "application/x-msgpack" });
  return ch.waitForConfirms();
}
