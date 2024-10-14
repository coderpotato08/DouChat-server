import dayjs from "dayjs";
import mongoose from "mongoose";
import { v4 } from "uuid";

const { Schema: { Types } } = mongoose;
export interface MeetingDocument {
  meetingId?: string,
  creator?: string,
  meetingName?: string,
  userList?: string[],
  isJoinedMuted: boolean,
  createTime: Date,
  endTime: Date,
}
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

export default mongoose.model<MeetingDocument>("meetings", MeetingSchema)