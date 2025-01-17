import { Schema, model } from "mongoose";
export enum ThirdPlatformEnum {
  GITHUB = "github",
}
export interface UserDocument {
  username: string;
  nickname: string;
  password: string;
  avatarImage: string;
  gender: "man" | "girl";
  phoneNumber?: string;
  sign?: string;
  email?: string;
  token?: string;
  thirdAccessToken?: string;
  thirdPlatform?: 'github' | undefined;
}
// 用户表
const userSchema = new Schema<UserDocument>(
  {
    /**
     * 账户
     */
    username: {
      type: String,
      required: true,
      min: 3,
      max: 20,
      unique: true,
    },
    /**
     * 昵称
     */
    nickname: {
      type: String,
      max: 30,
    },
    /**
     * 性别
     */
    gender: {
      type: String,
      enum: ["man", "girl"],
    },
    /**
     * 用户邮箱
     */
    email: {
      type: String,
      max: 50,
      unique: true,
    },
    /**
     * 用户密码 第三方登录默认123456
     */
    password: {
      type: String,
      required: true,
      min: 8,
    },
    /**
     * 用户头像
     */
    avatarImage: {
      type: String,
      default: "",
    },
    /**
     * 用户手机号
     */
    phoneNumber: {
      type: String,
    },
    /**
     * 用户个签
     */
    sign: {
      type: String,
      default: "",
    },
    /**
     * app token
     */
    token: {
      type: String,
      default: "",
    },
    /**
     * github 第三方平台 token
     */
    thirdAccessToken: {
      type: String,
      default: "",
    },
    /**
     * 第三方平台来源 github
     */
    thirdPlatform: {
      type: String,
      default: void 0,
    },
  },
  {
    timestamps: true,
  }
);

export default model<UserDocument>("Users", userSchema);
