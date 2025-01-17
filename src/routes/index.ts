import Koa from 'koa';
import userRouter from './userRoute';
import contactsRouter from './contactsRoute';
import messageRouter from './messageRoute';
import uploadRouter from './uploadRoute';
import meetingRouter from './meetingRoute';
import groupRouter from './groupRoute';
import notificationRouter from './notificationRoute';
import authRouter from './authRoute';
import aiRouter from './aiRoute';

export default (app: Koa) => {
  app.use(userRouter.routes()).use(userRouter.allowedMethods());
  app.use(contactsRouter.routes()).use(contactsRouter.allowedMethods());
  app.use(messageRouter.routes()).use(messageRouter.allowedMethods());
  app.use(uploadRouter.routes()).use(uploadRouter.allowedMethods());
  app.use(meetingRouter.routes()).use(meetingRouter.allowedMethods());
  app.use(groupRouter.routes()).use(groupRouter.allowedMethods());
  app.use(notificationRouter.routes()).use(notificationRouter.allowedMethods());
  app.use(authRouter.routes()).use(authRouter.allowedMethods());
  app.use(aiRouter.routes()).use(aiRouter.allowedMethods());
}