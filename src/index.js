const Koa = require('koa');
const http = require('http');
const path = require('path')
const bodyParser = require('koa-bodyparser');
const cors = require('koa2-cors');
const dotenv = require('dotenv');
const socket = require("socket.io")
const KoaStatic = require('koa-static')
const { initMongoose } = require('./app/dbConnect');
const socketRegister = require('./app/socket');
const routerRegister = require('./routes/index');
const { createRes } = require('./models/responseModel');
const { $SuccessCode, $ErrorCode, $ErrorMessage } = require("./constant/errorData");
// const session = require('./app/session')
dotenv.config();

const app = new Koa();
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
const server = http.createServer(app.callback());
server.listen(3040, () => {
  console.log('webSocket server is running on port 3040');
});

// 注册web socket
socketRegister(socket(server, {
  cors: {
    orgin: "http://localhost:3000",
    credentials: true,
  } 
}))

app.listen(3030);