import { Context } from "koa";
import { PassThrough } from "node:stream";

export const testSSE = async (ctx: Context) => {
  const msgList = [
    "在Shell脚本中，如果你希望将带有颜色的文本（如[${RED}ERROR${NC}]）作为一个公共变量，并在多次echo的时候使用它，你需要确保颜色变量（如${RED}和${NC}）在定义后是可访问的，并且你的终端支持这些颜色代码。",
    "通常，颜色代码是通过ANSI转义序列定义的。例如，${RED}可能定义为\\033[31m（红色），而${NC}（No Color）可能定义为\\033[0m（重置颜色）。",
    "在这个脚本中：",
    " 1. 我们首先定义了颜色变量RED和NC。",
    " 2. 然后，我们创建了一个公共变量ERROR_MESSAGE，它包含了错误消息前后的颜色代码。",
    " 3. 我们使用echo命令多次输出了这个带有颜色的错误消息。",
    " 4. 我们还定义了一个函数show_error，它接受一个参数并输出带有颜色的错误消息。",
    "请注意，这些颜色代码仅在支持ANSI转义序列的终端中有效。如果你在不支持这些颜色的终端（如某些旧版本的Windows命令提示符）上运行脚本，你可能看不到预期的颜色效果。",
    "另外，如果你的脚本需要在不同的环境中运行，并且你不确定终端是否支持颜色，你可能需要添加一些检查来确保颜色变量只在支持它们的终端中使用。",
  ];
  const stream = new PassThrough();

  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  ctx.status = 200;

  let index = 0;
  let timer = setInterval(() => {
    if (index < msgList.length) {
      stream.write(`data: ${msgList[index]}\n\n`);
      index++;
    } else {
      clearInterval(timer);
      stream.end();
    }
  }, 1000);
  stream.write("[DONE]\n\n");
  ctx.body = stream;
};
