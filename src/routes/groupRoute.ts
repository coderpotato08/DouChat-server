import {
  createGroup,
  loadGroupList,
  loadGroupUsers,
} from "../controllers/groupController";
import Router from "koa-router";

const router = new Router({
  prefix: '/group',
})

router.post('/create', createGroup);
router.post('/loadGroupList', loadGroupList);
router.post('/loadGroupUsers', loadGroupUsers);

export default router;