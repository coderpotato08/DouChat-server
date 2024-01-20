const {
  loadMessageList
} = require('../controllers/messageController')
const Router = require('koa-router');

const router = new Router({
  prefix: '/message'
});

router.post('/user-list', loadMessageList);

module.exports = router;