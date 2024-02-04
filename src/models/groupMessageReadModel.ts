import { Schema, model } from 'mongoose';

const { Types } = Schema;
export interface GroupMessageReadDocument {
  userId: Schema.Types.ObjectId,
  groupId: Schema.Types.ObjectId,
  messageId: Schema.Types.ObjectId,
  unread: boolean,
}
const GroupMessageReadSchema = new Schema<GroupMessageReadDocument>({
  userId: {
    type: Types.ObjectId,
    required: true,
  },
  groupId:  {
    type: Types.ObjectId,
    required: true,
  },
  messageId:  {
    type: Types.ObjectId,
    required: true,
  },
  unread: {
    type: Boolean,
    default: true,
  },
})

export default model<GroupMessageReadDocument>('group_message_reads', GroupMessageReadSchema)