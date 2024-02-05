import {
  createGroup,
  loadGroupInfo,
  loadGroupList,
  loadGroupUsers,
  quitGroup,
  disbandGroup,
  inviteGroupUsers,
  loadGroupNotifications,
  deleteGroupNotification,
  updateGroupInfo,
} from "../controllers/groupController";
import Router from "koa-router";

const router = new Router({
  prefix: '/group',
})

router.post('/create', createGroup);
router.post('/loadGroupInfo', loadGroupInfo);
router.post('/loadGroupList', loadGroupList);
router.post('/loadGroupUsers', loadGroupUsers);
router.post('/quitGroup', quitGroup);
router.post('/disbandGroup', disbandGroup);
router.post('/inviteGroupUsers', inviteGroupUsers);
router.post('/loadGroupNotifications', loadGroupNotifications);
router.post('/deleteGroupNotification', deleteGroupNotification);
router.post('/updateGroupInfo', updateGroupInfo);

export default router;