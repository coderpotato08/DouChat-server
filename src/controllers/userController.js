const User = require("../models/usersModel");
const Friends = require("../models/friendsModel");
const JwtUtil = require("../jwt/Jwt");
const { createRes } = require("../models/responseModel");
const { $ErrorCode, $ErrorMessage, $SuccessCode } = require("../constant/errorData");

const login = async (ctx) => {
  const { request } = ctx;
  const { username, password } = request.body;
  const userFind = await User.findOne({username});
  let responseData = {};
  try {
    if (userFind) {
      if(userFind.password === password) {
        const jwt = new JwtUtil({ username });
        const token = jwt.generateToken();
        delete userFind.password;
        const updateUserRes = await User.updateOne({ _id: userFind._id }, { token });
        responseData = createRes(10000, { 
          userInfo: userFind,
          token
        }, "")
      } else {
        responseData = createRes(
          $ErrorCode.PASSWORD_INVALID_ERROR, 
          null, 
          $ErrorMessage.PASSWORD_INVALID_ERROR
        )
      }
    } else {
      responseData = createRes(
        $ErrorCode.USERNAME_UNFOUND_ERROR, 
        null, 
        $ErrorMessage.USERNAME_UNFOUND_ERROR
      )
    }
    ctx.body = responseData
  } catch(err) {
    responseData = createRes(
      $ErrorCode.SERVER_ERROR,
      null, 
      $ErrorMessage.SERVER_ERROR
    )
    ctx.body = responseData
  }
}

const searchUser = async (ctx) => { // 模糊查询用户
  const { request } = ctx;
  const { keyWord, currUserId } = request.body;
  const regex = new RegExp(keyWord, 'i');
  try {
    const userList = await User.find({
      $or: [
        { nickname: regex },
        { username: regex },
      ],
    }, null, {lean: true});
    const newUserList = await Promise.all(userList.map(async (userInfo) => {
      const existfriend = await Friends.findOne({
        $or: [
          { userId: userInfo._id.toString(), friendId: currUserId },
          { friendId: userInfo._id.toString(), userId: currUserId }
        ]
      })
      userInfo.isFriend = existfriend && existfriend.status == 1;
      return userInfo;
    }))
    ctx.body = createRes($SuccessCode, {
      count: userList.length,
      userList,
    }, "")
  } catch(err) {
    console.log(err)
    ctx.body = createRes(
      $ErrorCode.SERVER_ERROR,
      null, 
      $ErrorMessage.SERVER_ERROR
    );
  }
}

const addFriend = async (ctx) => {  // 添加好友
  const { request } = ctx;
  const { userId, friendId } = request.body;
  const filter = {
    $or: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
  }
  const relationship = await Friends.findOne(filter);
  if(relationship) {
    if(relationship.status == 0) {
      ctx.body = createRes($SuccessCode, {
        status: "success",
        message: "已申请添加好友，请等待申请通过"
      }, "")
    } else if(relationship.status == 2) {
      await Friends.updateOne(filter, { status: 0 });
      ctx.body = createRes($SuccessCode, {
        status: "success",
        message: "申请成功"
      }, "")
    }
  } else {
    await Friends.create({ userId, friendId, status: 0 });
    ctx.body = createRes($SuccessCode, {
      status: "success",
      message: "申请成功"
    }, "")
  }
}

const socket_findOneUser = async (userId) => {
  const userInfo = await User.findOne({_id: userId});
  return userInfo
}

module.exports = {
  login,
  searchUser,
  addFriend,
  socket_findOneUser
}