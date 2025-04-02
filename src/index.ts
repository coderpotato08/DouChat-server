import Koa from "koa";
import http, { Server } from "http";
import path from "path";
import bodyParser from "koa-bodyparser";
import cors from "koa2-cors";
import dotenv from "dotenv";
import { Server as SocketServer, Socket } from "socket.io";
import KoaStatic from "koa-static";
import initMongoose from "./app/dbConnect";
import socketRegister from "./app/socket";
import routerRegister from "./routes/index";
import Log from "./console";
dotenv.config();

const ip = "0.0.0.0";
const app: Koa = new Koa();
const log: Log = new Log();
app.use(
  cors({
    credentials: true,
  })
);
app.use(KoaStatic(path.resolve(__dirname, "./public")));
app.use(bodyParser());
// app.keys = ["SECRET_KEY"];
// app.use(session(app));

routerRegister(app); // 注册路由
initMongoose(); // 连接数据库

// webSocket connect
const server: Server = http.createServer(app.callback());
server.listen(3040, () => {
  log
    .time()
    .success()
    .printLog(`WebSocket server is running on http://${ip}:3040`);
});
app.listen(3030, ip, () => {
  log.time().success().printLog(`server is running on http://${ip}:3030`);
});
// 本地支持同时启动4个客户端
const origins = [3000, 3001, 3002, 3003].map(
  (port) => `http://localhost:${port}`
);
// 注册web socket
const socketServer = new SocketServer(server, {
  cors: {
    origin: origins,
    credentials: true,
  },
});
socketRegister(socketServer);
