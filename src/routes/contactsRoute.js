const {
  loadUserContacts
} = require('../controllers/contactsController')
const Router = require('koa-router');

const router = new Router({
  prefix: '/contacts'
});

router.post('/user-contact-list', loadUserContacts);

module.exports = router;