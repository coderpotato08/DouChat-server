import Router from "koa-router";
import { agentCompletion, agentPermission, getSession, getSessionList, initAgent, initSession } from "../controllers/ai/controller";
import {
  agentCompletionBodySchema,
  agentPermissionBodySchema,
  getSessionBodySchema,
  getSessionListBodySchema,
  initSessionBodySchema,
} from "../controllers/ai/validator";
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
router.post(
  "/session/get",
  validateRequest({ body: getSessionBodySchema }),
  getSession,
);
router.post(
  "/session/list",
  validateRequest({ body: getSessionListBodySchema }),
  getSessionList,
);
router.post(
  "/session/init",
  validateRequest({ body: initSessionBodySchema }),
  initSession,
);

export default router;
