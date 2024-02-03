import {
  loadUserContact,
  loadUserContactList,
  createGroupContact,
  loadGroupContactList,
  loadGroupContact,
} from '../controllers/contactsController'
import Router from 'koa-router';

const router = new Router({
  prefix: '/contacts'
});

router.post('/user-contact-list', loadUserContactList);
router.post('/loadUserContact', loadUserContact);
router.post('/createGroupContact', createGroupContact);
router.post('/loadGroupContactList', loadGroupContactList);
router.post('/loadGroupContact', loadGroupContact)

export default router;