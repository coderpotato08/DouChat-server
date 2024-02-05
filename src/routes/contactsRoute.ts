import {
  loadUserContact,
  loadUserContactList,
  createUserContact,
  createGroupContact,
  loadGroupContactList,
  loadGroupContact,
  deleteUserContact,
  deleteGroupContact,
} from '../controllers/contactsController'
import Router from 'koa-router';

const router = new Router({
  prefix: '/contacts'
});

router.post('/user-contact-list', loadUserContactList);
router.post('/loadUserContact', loadUserContact);
router.post('/createUserContact', createUserContact);
router.post('/createGroupContact', createGroupContact);
router.post('/loadGroupContactList', loadGroupContactList);
router.post('/loadGroupContact', loadGroupContact);
router.post('/deleteUserContact', deleteUserContact);
router.post('/deleteGroupContact', deleteGroupContact);

export default router;