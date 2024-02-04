import {
  createGroup,
  loadGroupList,
  loadGroupUsers,
  quitGroup,
  disbandGroup,
  inviteGroupUsers,
  loadGroupNotifications,
  deleteGroupNotification,
} from "../controllers/groupController";
import Router from "koa-router";

const router = new Router({
  prefix: '/group',
})

router.post('/create', createGroup);
router.post('/loadGroupList', loadGroupList);
router.post('/loadGroupUsers', loadGroupUsers);
router.post('/quitGroup', quitGroup);
router.post('/disbandGroup', disbandGroup);
router.post('/inviteGroupUsers', inviteGroupUsers);
router.post('/loadGroupNotifications', loadGroupNotifications);
router.post('/deleteGroupNotification', deleteGroupNotification);

export default router;