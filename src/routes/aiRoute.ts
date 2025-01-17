import Router from "koa-router";
import { testSSE } from "../controllers/aiController";

const router = new Router({
  prefix: '/ai',
});

router.get('/test-sse', testSSE);

export default router;