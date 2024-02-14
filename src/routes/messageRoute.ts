import {
  loadMessageList,
  loadGroupMessageList,
  searchMessageList,
  searchMatchGroupMessageList,
  searchMatchUserMessageList,
} from '../controllers/messageController';
import Router from 'koa-router';

const router = new Router({
  prefix: '/message'
});

router.post('/loadUserMessageList', loadMessageList);
router.post('/loadGroupMessageList', loadGroupMessageList);
router.post('/searchMessageList', searchMessageList);
router.post('/searchMatchGroupMessageList', searchMatchGroupMessageList);
router.post('/searchMatchUserMessageList', searchMatchUserMessageList);

export default router;