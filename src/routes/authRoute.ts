import Router from "koa-router";
import {
  githubAuth,
  githubAuthAccess,
  googleAuth,
  googleAuthAccess,
} from "../controllers/authController";

const router = new Router({
  prefix: "/auth",
});

router.get("/github", githubAuth);
router.get("/google", googleAuth);
router.post("/github/access", githubAuthAccess);
router.post("/google/access", googleAuthAccess);

export default router;
