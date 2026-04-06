import Router from "koa-router";
import { ds_completions, initAgent, testSSE } from "../controllers/aiController";

const router = new Router({
  prefix: '/ai',
});

router.get('/test-sse', testSSE);
router.post('/completions', ds_completions);
router.post('/init', initAgent);

export default router;