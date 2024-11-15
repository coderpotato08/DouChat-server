import Router from "koa-router";
import { githubAuth, githubAuthAccess } from "../controllers/authController";

const router = new Router({
  prefix: '/auth',
})

router.get('/github', githubAuth);
router.post('/github/access', githubAuthAccess);

export default router;