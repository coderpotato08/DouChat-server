import Router from "koa-router";
import { agentCompletion, initAgent, testSSE } from "../controllers/aiController";

const router = new Router({
  prefix: '/ai',
});

router.get('/test-sse', testSSE);
router.post('/agent/init', initAgent);
router.post('/agent/completion', agentCompletion);

export default router;