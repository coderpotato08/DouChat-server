import {
  loadUserContact,
  loadUserContactList,
} from '../controllers/contactsController'
import Router from 'koa-router';

const router = new Router({
  prefix: '/contacts'
});

router.post('/user-contact-list', loadUserContactList);
router.post('/loadUserContact', loadUserContact)

export default router;