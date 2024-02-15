import dayjs from "dayjs";
import mongoose from "mongoose";
import { v4 } from "uuid";

const { Schema: { Types } } = mongoose;
const MeetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    default: v4(),
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
    type: Date,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  },
  endTime: {
    type: Date,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  },
})

export default mongoose.model("meetings", MeetingSchema)