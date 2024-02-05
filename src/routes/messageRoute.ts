import {
  loadMessageList,
  loadGroupMessageList,
  loadAllUnreadMesageNum,
} from '../controllers/messageController';
import Router from 'koa-router';

const router = new Router({
  prefix: '/message'
});

router.post('/loadUserMessageList', loadMessageList);
router.post('/loadGroupMessageList', loadGroupMessageList);
router.post('/loadAllUnreadMesageNum', loadAllUnreadMesageNum)

export default router;