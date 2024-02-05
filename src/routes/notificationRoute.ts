import Router from 'koa-router';
import { 
  deleteFriendNotification,
  deleteGroupNotification,
  loadFriendNotifications,
  loadGroupNotifications,
} from '../controllers/notificationController';

const router = new Router({
  prefix: '/notification'
});

router.post('/loadFriendNotifications', loadFriendNotifications);
router.post('/deleteFriendNotification', deleteFriendNotification);
router.post('/loadGroupNotifications', loadGroupNotifications);
router.post('/deleteGroupNotification', deleteGroupNotification);

export default router;