import { Schema, model } from "mongoose";

export interface UserDocument {
    username: string,
    nickname: string,
    password: string,
    avatarImage: string,
    gender: "man" | "girl",
    phoneNumber?: string,
    sign?: string,
    email?: string,
    token?: string,
}
// 用户表
const userSchema = new Schema<UserDocument>({
    username: { 
        type: String,
        required: true,
        min: 3,
        max: 20,
        unique: true
    },
    nickname: {
        type: String,
        max: 30,
    },
    gender: {
        type: String,
        enum: ["man", "girl"],
    },
    email: {
        type: String,
        required: true,
        max: 50,
        unique: true
    },
    password: {
        type: String,
        required: true,
        min: 8
    },
    avatarImage: {
        type: String,
        default: ""
    },
    phoneNumber: {
        type: String,
    },
    sign: {
        type: String,
    },
    token: {
        type: String,
        default: "",
    }
},{
    timestamps: true,
})

export default model<UserDocument>("Users", userSchema);