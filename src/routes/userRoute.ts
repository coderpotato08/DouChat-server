import {
  login,
  searchUser,
  addFriend,
} from '../controllers/userController';
import Router from 'koa-router';

const router = new Router({
  prefix: '/user'
});

router.post('/login', login);
router.post('/search', searchUser)
router.post('/add-friend', addFriend)

export default router;