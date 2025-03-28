import Router from "koa-router";
import { ds_completions, testSSE } from "../controllers/aiController";

const router = new Router({
  prefix: '/ai',
});

router.get('/test-sse', testSSE);
router.post('/completions', ds_completions);

export default router;