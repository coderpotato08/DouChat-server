import Koa from 'koa';
import userRouter from './userRoute';
import contactsRouter from './contactsRoute';
import messageRouter from './messageRoute';
import uploadRouter from './uploadRoute';
import meetingRouter from './meetingRoute';

export default (app: Koa) => {
  app.use(userRouter.routes()).use(userRouter.allowedMethods());
  app.use(contactsRouter.routes()).use(contactsRouter.allowedMethods());
  app.use(messageRouter.routes()).use(messageRouter.allowedMethods());
  app.use(uploadRouter.routes()).use(uploadRouter.allowedMethods());
  app.use(meetingRouter.routes()).use(meetingRouter.allowedMethods())
}