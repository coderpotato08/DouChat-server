import {
  createGroup,
  loadGroupList,
  loadGroupUsers,
  quitGroup,
  disbandGroup
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

export default router;