import Router from "koa-router";
import { agentCompletion, agentPermission, initAgent } from "../controllers/ai/controller";
import { agentCompletionBodySchema, agentPermissionBodySchema } from "../controllers/ai/validator";
import { approvalTask, startTask } from "../controllers/approvalController";
import { validateRequest } from "../middleware/validate-request";
import { createSSESession } from "../utils/sse-utils";

const router = new Router({
  prefix: "/ai",
});

router.post("/agent/init", initAgent);
router.post(
  "/agent/completion",
  validateRequest(
    {
      body: agentCompletionBodySchema,
    },
    {
      onValidationError: (ctx, payload) => {
        const sseSession = createSSESession(ctx);
        sseSession.sendError(payload.message);
        sseSession.close();
      },
    },
  ),
  agentCompletion,
);
router.post(
  "/agent/permission",
  validateRequest({
    body: agentPermissionBodySchema,
  }),
  agentPermission,
);
router.post("/agent/approval/startTask", startTask);
router.post("/agent/approval/approveTask", approvalTask);

export default router;
