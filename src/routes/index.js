const userRouter = require('./userRoute');
const contactsRouter = require('./contactsRoute');
const messageRouter = require('./messageRoute');
const uploadRouter = require('./uploadRoute');
const meetingRouter = require('./meetingRoute');

module.exports = (app) => {
  app.use(userRouter.routes()).use(userRouter.allowedMethods());
  app.use(contactsRouter.routes()).use(contactsRouter.allowedMethods());
  app.use(messageRouter.routes()).use(messageRouter.allowedMethods());
  app.use(uploadRouter.routes()).use(uploadRouter.allowedMethods());
  app.use(meetingRouter.routes()).use(meetingRouter.allowedMethods())
}