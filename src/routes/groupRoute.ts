import {
  createGroup,
  loadGroupInfo,
  loadGroupList,
  loadGroupUsers,
  quitGroup,
  disbandGroup,
  inviteGroupUsers,
  updateGroupInfo,
  searchGroupList
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
router.post('/updateGroupInfo', updateGroupInfo);
router.post('/searchGroupList', searchGroupList)

export default router;