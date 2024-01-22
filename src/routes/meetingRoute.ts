import {
  createMeeting,
  loadMeetingInfo,
} from "../controllers/meetingController"
import Router from "koa-router";

const router = new Router({
  prefix: '/meeting'
})

router.post('/create', createMeeting);
router.post('/getInfo', loadMeetingInfo);

export default router;