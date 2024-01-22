import {
  loadMessageList
} from '../controllers/messageController';
import Router from 'koa-router';

const router = new Router({
  prefix: '/message'
});

router.post('/user-list', loadMessageList);

export default router;