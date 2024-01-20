const mongoose = require("mongoose");

// 用户表
const userSchema = new mongoose.Schema({
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

module.exports = mongoose.model("Users", userSchema);