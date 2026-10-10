/** Read JSON SSE frames without assuming byte, line, or event boundaries. */
export async function* readSse<T extends { type: string }>(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let data: string[] = [];
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
  };
  function frame(): T | undefined {
    if (!data.length) { event = ""; return; }
    const parsed: unknown = JSON.parse(data.join("\n"));
    data = [];
    if (typeof parsed !== "object" || parsed === null || !("type" in parsed) || parsed.type !== event) {
      throw new Error("Invalid interview stream event.");
    }
    event = "";
    // The operation's generated union describes the JSON event payload.
    return parsed as T;
  }
  try {
    checkAbort();
    while (true) {
      const chunk = await reader.read();
      checkAbort();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (line === "") {
          const value = frame();
          checkAbort();
          if (value) yield value;
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon < 0 ? line : line.slice(0, colon);
          const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = value;
          if (field === "data") data.push(value);
        }
      }
      if (chunk.done) break;
    }
    if (buffer || data.length) throw new Error("The interview stream ended inside an event.");
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
