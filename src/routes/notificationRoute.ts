import Router from 'koa-router';
import { 
  deleteFriendNotification,
  deleteGroupNotification,
  loadFriendNotifications,
  loadGroupNotifications,
  loadAllUnreadCounts,
} from '../controllers/notificationController';

const router = new Router({
  prefix: '/notification'
});

router.post('/loadFriendNotifications', loadFriendNotifications);
router.post('/deleteFriendNotification', deleteFriendNotification);
router.post('/loadGroupNotifications', loadGroupNotifications);
router.post('/deleteGroupNotification', deleteGroupNotification);
router.post('/loadAllUnreadCounts', loadAllUnreadCounts)

export default router;
