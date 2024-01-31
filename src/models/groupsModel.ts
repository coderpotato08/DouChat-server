import { Schema, model } from 'mongoose';

const { Types } = Schema;
export interface GroupDocument {
  creator: Schema.Types.ObjectId,
  groupName: string,
  groupNumber: number,
  sign?: string,
  createTime?: Date,
}
const GroupSchema = new Schema<GroupDocument>({
  creator: {   // 群主
    type: Types.ObjectId,
    ref: "Users"
  },
  groupName: {   // 群名称
    type: String,
  },
  groupNumber: {   // 群号
    type: Number,
    unique: true,
  },
  sign: { // 群简介
    type: String
  },
  createTime: { // 创建时间
    type: Date,
    default: new Date()
  }
})

export default model<GroupDocument>("groups", GroupSchema)