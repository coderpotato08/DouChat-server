import Router from "koa-router";
import { agentCompletion, agentPermission, initAgent } from "../controllers/aiController";
import { approvalTask, startTask } from "../controllers/approvalController";

const router = new Router({
  prefix: "/ai",
});

router.post("/agent/init", initAgent);
router.post("/agent/completion", agentCompletion);
router.post("/agent/permission", agentPermission);
router.post("/agent/approval/startTask", startTask);
router.post("/agent/approval/approveTask", approvalTask);

export default router;
