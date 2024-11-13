import dayjs from "dayjs";
import {
  HydratedDocument,
  Model,
  QueryWithHelpers,
  Schema,
  model,
} from "mongoose";
import { UserDocument } from "./usersModel";

const { Types } = Schema;
export interface GroupUserDocument {
  groupId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  time?: Date;
}

type GroupUserModelType = Model<GroupUserDocument>;

const GroupUserSchema = new Schema<GroupUserDocument, Model<GroupUserDocument>>(
  {
    groupId: {
      // 群id
      type: Types.ObjectId,
      ref: "groups",
    },
    userId: {
      // 用户id
      type: Types.ObjectId,
      ref: "Users",
    },
    time: {
      // 创建时间
      type: Date,
      default: Date.now,
      get: (date: Date) => dayjs(date).format("YYYY-MM-DD HH:mm:ss"),
    },
  }
);

export default model<GroupUserDocument, GroupUserModelType>(
  "group_user",
  GroupUserSchema
);
