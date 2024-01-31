import {
  login,
  register,
  searchUser,
  addFriend,
  loadUserInfo,
  loadFriendList,
  loadFriendNotifications,
  changetFriendStatus,
} from '../controllers/userController';
import Router from 'koa-router';

const router = new Router({
  prefix: '/user'
});

router.post('/login', login);
router.post('/register', register)
router.post('/search', searchUser);
router.post('/loadUserInfo', loadUserInfo);
router.post('/add-friend', addFriend);
router.post('/friend/list', loadFriendList);
router.post('/friend/notification', loadFriendNotifications);
router.post('/friend/changeStatus', changetFriendStatus)

export default router;