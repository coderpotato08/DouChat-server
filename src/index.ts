import Koa from 'koa';
import http, { Server } from 'http';
import path from 'path';
import bodyParser from 'koa-bodyparser';
import cors from 'koa2-cors';
import dotenv from 'dotenv';
import { Server as SocketServer, Socket } from 'socket.io';
import KoaStatic from 'koa-static';
import initMongoose from './app/dbConnect';
import socketRegister from './app/socket';
import routerRegister from './routes/index';
import Log from './console';
import { time } from 'console';
dotenv.config();

const app: Koa = new Koa();
const log: Log = new Log();
app.use(cors({
  credentials: true,
}));
app.use(KoaStatic(path.resolve(__dirname, './public')));
app.use(bodyParser());
// app.keys = ["SECRET_KEY"];
// app.use(session(app));

routerRegister(app) // 注册路由
initMongoose(); // 连接数据库

// webSocket connect
const server: Server = http.createServer(app.callback());
server.listen(3040, () => {
  log.time().success().printLog('webSocket server is running on port 3040');
});

// 注册web socket
const socketServer = new SocketServer(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  } 
});
socketRegister(socketServer)

app.listen(3030);