const {
  login,
  searchUser,
  addFriend,
} = require('../controllers/userController');
const Router = require('koa-router');

const router = new Router({
  prefix: '/user'
});

router.post('/login', login);
router.post('/search', searchUser)
router.post('/add-friend', addFriend)

module.exports = router;