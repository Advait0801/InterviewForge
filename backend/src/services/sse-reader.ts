/**
 * Reads a `text/event-stream` body (the ai-service's question streams, D-065).
 *
 * Pull-based on purpose: the next chunk is read only when the consumer asks for the
 * next event, so a consumer that awaits its own slow write (the browser's socket) stops
 * reading here, and TCP flow control carries that back to the ai-service and the model.
 */
export type ServerSentEvent = { event: string; data: string };

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n?/g, "\n");

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseBlock(block);
        if (parsed) yield parsed;
      }
      if (done) {
        const tail = parseBlock(buffer);
        if (tail) yield tail;
        return;
      }
    }
  } finally {
    // Early exit (a `done` event, an abort, a thrown consumer): release the connection.
    await reader.cancel().catch(() => undefined);
  }
}

function parseBlock(block: string): ServerSentEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue; // blank or a comment (keepalive)
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
