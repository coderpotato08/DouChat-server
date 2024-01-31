import {
  loadMessageList
} from '../controllers/messageController';
import Router from 'koa-router';

const router = new Router({
  prefix: '/message'
});

router.post('/userMessageList', loadMessageList);

export default router;