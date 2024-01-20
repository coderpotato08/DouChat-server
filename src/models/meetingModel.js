const mongoose = require("mongoose");
const uuid = require("uuid");
const { Schema: { Types } } = mongoose

const MeetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    default: uuid.v4(),
  },
  creator: {
    type: Types.ObjectId, 
    ref: 'Users',
  },
  meetingName: {
    type: String
  },
  userList: [{ 
    type: Types.ObjectId, 
    ref: 'Users' 
  }],
  isJoinedMuted: {
    type: Boolean,
  },
  createTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
})

module.exports = mongoose.model("meetings", MeetingSchema)