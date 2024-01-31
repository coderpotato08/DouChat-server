import { Server } from "socket.io";
import logUtil, { LogGenerateType } from '../utils/log-utils';
import {
  saveUserMessage
} from '../controllers/messageController';
import {
  socket_findOneUser,
} from "../controllers/userController";
import { 
  updateMeetingEndTime 
}from '../controllers/meetingController';
import { 
  addContactUnread, cleanContactUnread 
} from "../controllers/contactsController";
import { EventType } from "../constant/socketTypes";

const socketRegister = (io: Server) => {
  const onlineUser = new Map(); // 在线用户
  const logOnlineInfo = logUtil(LogGenerateType.ONLINE_USER); 
  // ----------- 会议 ----------------------
  const meetingMap = new Map(); // 房间映射
  const socketMap = new Map(); // 客户端socket实例

  io.on("connection", (socket) => {

     // ----------- 聊天 ----------------------
    socket.on(EventType.ADD_USER, (userInfo) => {
      const { username, _id } = userInfo
      if (!onlineUser.has(_id)) {
        logOnlineInfo(userInfo, onlineUser.size+1)
      };
      onlineUser.set(_id, socket.id)
    });
  
    socket.on(EventType.SEND_MESSAGE, async (data) => {
      const msgData: any = await saveUserMessage(data);
      const { fromId, toId } = msgData;
      const contactId = [toId._id, fromId._id].sort().join("_");
      const toSocketId = onlineUser.get(toId._id.toString());
      await addContactUnread(contactId);
      socket.to(toSocketId).emit(EventType.RECEIVE_MESSAGE, msgData);
    })

    socket.on(EventType.READ_MESSAGE, async ({ fromId, toId }) => {
      await cleanContactUnread(fromId, toId);
    })

    // ----------- 会议 ----------------------
    socket.on(EventType.INVITE_MEETING, async (data) => {
      const { creator, meetingId, meetingName, userList } = data
      const creatorInfo = await socket_findOneUser(creator)
      userList.forEach((userId: string) => {
        const toSocketId = onlineUser.get(userId);
        toSocketId && socket.to(toSocketId).emit(EventType.INVITE_MEETING, {
          ...data,
          creator: creatorInfo
        });
      });
    })

    socket.on(EventType.REJECT_INVITE, ({ meetingId, userId }) => {  // 通知其他成员，该用户已拒听
      socket.in(meetingId).emit(EventType.REJECT_INVITE, {userId});
    })

    socket.on(EventType.CREATE_MEETING, ({ meetingId, meetingInfo, userInfo }) => {
      const { creator, userList, isJoinedMuted } = meetingInfo;
      const deviceStatus = { cameraEnable: false, audioEnable: !isJoinedMuted }
      const inviteUserList = userList.map((user: any) => ({
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
      socket.emit(EventType.JOINED_MEETING, params); // 通知本人入会成功
      socket.to(meetingId).emit(EventType.JOINED_MEETING, params); // 通知其他成员入会成功
    });

    socket.on(EventType.JOIN_MEETING, ({ meetingId, userInfo }) => {
      if(meetingMap.get(meetingId)) {
        const { userList, socketId } = meetingMap.get(meetingId)
        userList.forEach((user: any) => {
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
        socket.emit(EventType.JOINED_MEETING, params) // 通知本人入会成功
        socket.to(meetingId).emit(EventType.JOINED_MEETING, params); // 通知其他成员入会成功
      }
    });

    socket.on(EventType.END_MEETING, async (meetingId) => { // 结束会议
      if(meetingMap.get(meetingId)) {
        const success = await updateMeetingEndTime(meetingId) // 更新会议结束时间
        if (success) {
          meetingMap.delete(meetingId);
          socket.leave(meetingId);
          socket.to(meetingId).emit(EventType.END_MEETING, meetingId);
        }
      }
    }) 

    socket.on(EventType.LEAVE_MEETING, ({ meetingId, userId }) => {
      const meetingInfo = meetingMap.get(meetingId);
      if(meetingInfo) {
        const { userList } = meetingInfo;
        userList.forEach((user: any) => {
          if(user._id === userId) {
            user.status = 3;
            user.socketId = "";
          }
        })
        socket.leave(meetingId);
        socket.to(meetingId).emit(EventType.LEAVE_MEETING, { users: userList })
      }
    })

    socket.on(EventType.DEVICE_STATUS_CHANGE, (data) => {
      const { meetingId, userId, device, enable } = data;
      const meetingInfo = meetingMap.get(meetingId);
      if(meetingInfo) {
        const { userList } = meetingInfo;
        userList.forEach((user: any) => {
          if(user._id === userId) {
            const key = device === "audio" ? "audioEnable" : "cameraEnable";
            user[key] = enable;
          }
        })
        socket.to(meetingId).emit(EventType.DEVICE_STATUS_CHANGE, data)
      }
    })

    socket.on(EventType.SEND_OFFER, (data) => {
      const { meetingId, peerId } = data
      console.log(`[offer]peerId ${peerId}`)
      socket.to(meetingId).emit(EventType.SEND_OFFER, data);
    });

    socket.on(EventType.ANSWER_OFFER, (data) => {
      const { meetingId, peerId } = data
      console.log(`[answer]peerId ${peerId}`)
      socket.to(meetingId).emit(EventType.ANSWER_OFFER, data);
    });

    socket.on(EventType.ICE_CANDIDATE, (data)=>{
      const { meetingId } = data;
      socket.to(meetingId).emit(EventType.ICE_CANDIDATE, data);
    });
  })
}

export default socketRegister;