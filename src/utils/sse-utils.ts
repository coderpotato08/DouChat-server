import { Context } from "koa";
import { PassThrough } from "node:stream";

export type SSESession = {
  stream: PassThrough;
  close: () => void;
  sendError: (message: string) => void;
  isClosed: () => boolean;
};

export const setSSEHeaders = (ctx: Context) => {
  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  ctx.status = 200;
};

export const writeSSEData = (stream: PassThrough, payload: string) => {
  stream.write(`data: ${payload}\n\n`);
};

export const createSSESession = (ctx: Context): SSESession => {
  const stream = new PassThrough();
  let closed = false;

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    writeSSEData(stream, "[DONE]");
    stream.end();
    ctx.req.off("close", close);
  };

  const sendError = (message: string) => {
    if (closed) {
      return;
    }
    writeSSEData(
      stream,
      JSON.stringify({
        type: "error",
        error: message,
      })
    );
  };

  ctx.req.on("close", close);
  setSSEHeaders(ctx);
  ctx.body = stream;

  return {
    stream,
    close,
    sendError,
    isClosed: () => closed,
  };
};
