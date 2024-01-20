const logUtil = require('../utils/log-utils');
const {
  saveUserMessage
} = require('../controllers/messageController');
const {
  socket_findOneUser,
} = require("../controllers/userController");
const { updateMeetingEndTime } = require('../controllers/meetingController');

module.exports = (io) => {
  const onlineUser = new Map(); // 在线用户
  const logOnlineInfo = logUtil('online-user'); 
  // ----------- 会议 ----------------------
  const meetingMap = new Map(); // 房间映射
  const socketMap = new Map(); // 客户端socket实例

  io.on("connection", (socket) => {

     // ----------- 聊天 ----------------------
    socket.on("add-user", (userInfo) => {
      const { username, _id } = userInfo
      if (!onlineUser.has(_id)) {
        logOnlineInfo(userInfo, onlineUser.size+1)
      };
      onlineUser.set(_id, socket.id)
    });
  
    socket.on("send-message", async (data) => {
      const msgData = await saveUserMessage(data);
      const toId = msgData.toId.toString();
      const toSocketId = onlineUser.get(toId);
      socket.to(toSocketId).emit("receive-message", msgData);
    })

    // ----------- 会议 ----------------------
    socket.on("meeting-invite", async (data) => {
      const { creator, meetingId, meetingName, userList } = data
      const creatorInfo = await socket_findOneUser(creator)
      userList.forEach((userId) => {
        const toSocketId = onlineUser.get(userId);
        toSocketId && socket.to(toSocketId).emit("meeting-invite", {
          ...data,
          creator: creatorInfo
        });
      });
    })

    socket.on("reject-invite", ({ meetingId, userId }) => {  // 通知其他成员，该用户已拒听
      socket.in(meetingId).emit("reject-invite", {userId});
    })

    socket.on("create-meeting", ({ meetingId, meetingInfo, userInfo }) => {
      const { creator, userList, isJoinedMuted } = meetingInfo;
      const deviceStatus = { cameraEnable: false, audioEnable: !isJoinedMuted }
      const inviteUserList = userList.map((user) => ({
        ...user,
        ...deviceStatus,
        type: 'participant',
        status: 0,  // 0呼叫中 1已拒绝 2已入会 3已退出
      }))
      const allUserList = [
        {...creator, ...deviceStatus, type: 'creator', status: 2, socketId: socket.id}, // 0呼叫中 1已拒绝 2已入会 3已退出
        ...inviteUserList,
      ]
      if(!meetingMap.get(meetingId)) {
        meetingMap.set(meetingId, {
          userList: allUserList,
        })
      }
      const params = {
        users: meetingMap.get(meetingId).userList,
        socketId: socket.id,
        userInfo,
      }
      socketMap.set(userInfo._id, socket);
      socket.join(meetingId); // 入会
      socket.emit('joined-meeting', params); // 通知本人入会成功
      socket.to(meetingId).emit('joined-meeting', params); // 通知其他成员入会成功
    });

    socket.on("join-meeting", ({ meetingId, userInfo }) => {
      if(meetingMap.get(meetingId)) {
        const { userList, socketId } = meetingMap.get(meetingId)
        userList.forEach((user) => {
          if(user._id == userInfo._id) {
            user.status = 2;
            user.socketId = socket.id;
          }
        })
        const params = {
          users: userList,
          socketId: socket.id,
          userInfo,
        }
        socketMap.set(userInfo._id, socket);
        socket.join(meetingId); // 入会
        socket.emit('joined-meeting', params) // 通知本人入会成功
        socket.to(meetingId).emit('joined-meeting', params); // 通知其他成员入会成功
      }
    });

    socket.on('end-meeting', async (meetingId) => { // 结束会议
      if(meetingMap.get(meetingId)) {
        const success = await updateMeetingEndTime(meetingId) // 更新会议结束时间
        if (success) {
          meetingMap.delete(meetingId);
          socket.leave(meetingId);
          socket.to(meetingId).emit('end-meeting', meetingId);
        }
      }
    }) 

    socket.on('leave-meeting', ({ meetingId, userId }) => {
      const meetingInfo = meetingMap.get(meetingId);
      if(meetingInfo) {
        const { userList } = meetingInfo;
        userList.forEach((user) => {
          if(user._id === userId) {
            user.status = 3;
            socketId = "";
          }
        })
        socket.leave(meetingId);
        socket.to(meetingId).emit('leave-meeting', { users: userList })
      }
    })

    socket.on('device-status-change', (data) => {
      const { meetingId, userId, device, enable } = data;
      const meetingInfo = meetingMap.get(meetingId);
      if(meetingInfo) {
        const { userList } = meetingInfo;
        userList.forEach((user) => {
          if(user._id === userId) {
            const key = device === "audio" ? "audioEnable" : "cameraEnable";
            user[key] = enable;
          }
        })
        socket.to(meetingId).emit('device-status-change', data)
      }
    })

    socket.on('send-offer', (data) => {
      const { meetingId, peerId } = data
      console.log(`[offer]peerId ${peerId}`)
      socket.to(meetingId).emit('send-offer', data);
    });

    socket.on('answer-offer', (data) => {
      const { meetingId, peerId } = data
      console.log(`[answer]peerId ${peerId}`)
      socket.to(meetingId).emit('answer-offer', data);
    });

    socket.on('ice_candidate', (data)=>{
      const { meetingId } = data;
      socket.to(meetingId).emit('ice_candidate', data);
    });
  })
}