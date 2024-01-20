const {
  createMeeting,
  loadMeetingInfo,
} = require("../controllers/meetingController")
const Router = require("koa-router");

const router = new Router({
  prefix: '/meeting'
})

router.post('/create', createMeeting);
router.post('/getInfo', loadMeetingInfo);

module.exports = router;