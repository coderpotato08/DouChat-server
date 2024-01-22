import { Schema, model } from "mongoose";

export interface UserDocument {
    username: string,
    nickname: string,
    email: string,
    password: string,
    avatarImage: string,
    token: string,
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
    token: {
        type: String,
        default: "",
    }
},{
    timestamps: true,
})

export default model<UserDocument>("Users", userSchema);