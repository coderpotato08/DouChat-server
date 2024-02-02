import {
  loadUserContact,
  loadUserContactList,
  createGroupContact,
  loadGroupContactList,
} from '../controllers/contactsController'
import Router from 'koa-router';

const router = new Router({
  prefix: '/contacts'
});

router.post('/user-contact-list', loadUserContactList);
router.post('/loadUserContact', loadUserContact);
router.post('/createGroupContact', createGroupContact);
router.post('/loadGroupContactList', loadGroupContactList);

export default router;