import { Server, Socket } from "socket.io";
import logUtil, { LogGenerateType } from '../utils/log-utils';
import {
  saveUserMessage,
  socket_CleanGroupMessageUnread,
  socket_GroupMessageUnread,
  socket_SaveGroupMessage,
} from '../controllers/messageController';
import {
  socket_findOneUser,
} from "../controllers/userController";
import { 
  updateMeetingEndTime 
}from '../controllers/meetingController';
import { 
  addContactUnread, 
  cleanContactUnread 
} from "../controllers/contactsController";
import { 
  socket_ChangeGroupNotificationStatus,
  socket_getGroups 
} from './../controllers/groupController';
import { 
  EventType, 
  SocketChangeGroupStatusParams, 
  SocketCleanGroupMessageUnreadParams, 
  SocketGroupUserQuitParams, 
  SocketSendGroupMessageParams, 
  SocketUserLogoutParams
} from "../constant/socketTypes";
import { MessageTypeEnum } from "../constant/commonTypes";
import dayjs from "dayjs";

const socketRegister = (io: Server) => {
  const onlineUser = new Map(); // 在线用户
  const logOnlineInfo = logUtil(LogGenerateType.ONLINE_USER); 

  const groupRoomMap: Map<string, Set<string>> = new Map(); // 群聊房间映射
  const meetingMap = new Map(); // 房间映射
  const socketMap = new Map<string, Socket>(); // 客户端socket实例

  io.on("connection", async (socket) => {

     // ----------- 聊天 ----------------------
    /** 用户登录 */
    socket.on(EventType.ADD_USER, async (userInfo) => {
      const { _id } = userInfo
      if (!onlineUser.has(_id)) {
        logOnlineInfo(userInfo, onlineUser.size+1, 'login');
      };
      onlineUser.set(_id, socket.id)
      const groupList = await socket_getGroups(_id);
      groupList.forEach((group) => {  // 入群
        const groupId = group.groupId.toString();
        if(!groupRoomMap.has(groupId)) {
          groupRoomMap.set(groupId, new Set([_id]))
        } else {
          const userSet = groupRoomMap.get(groupId);
          userSet!.add(_id);
        }
        socket.join(groupId);
      })
    });
    /** 用户退出登录 */
    socket.on(EventType.USER_QUIT_APP, (userInfo: SocketUserLogoutParams) => {
      const { _id: userId } = userInfo;
      if (!onlineUser.has(userId)) return;
      onlineUser.delete(userId);
      logOnlineInfo(userInfo, onlineUser.size, 'quit');
    })
    /** 发送私人消息 */
    socket.on(EventType.SEND_MESSAGE, async (data) => {
      const msgData: any = await saveUserMessage(data);
      const { fromId, toId } = msgData;
      const contactId = [toId._id, fromId._id].sort().join("_");
      const toSocketId = onlineUser.get(toId._id.toString());
      await addContactUnread(contactId);
      socket.to(toSocketId).emit(EventType.RECEIVE_MESSAGE, msgData);
    })
    /** 消息已读 */
    socket.on(EventType.READ_MESSAGE, async ({ fromId, toId }) => {
      await cleanContactUnread(fromId, toId);
    })
    /** 用户加入群聊 */
    socket.on(EventType.ADD_GROUOP_USER, ({userId, groupId}) => {
      if(!groupRoomMap.has(groupId)) {
        groupRoomMap.set(groupId, new Set([userId]))
      } else {
        const userSet = groupRoomMap.get(groupId);
        userSet!.add(userId);
      }
      socket.join(groupId);
    })
    /** 发送群聊消息 */
    socket.on(EventType.SEND_GROUP_MESSAGE, async (data: SocketSendGroupMessageParams) => {
      try {
        const { groupId, fromId } = data;
        const msgData: any = await socket_SaveGroupMessage(data);
        const messageId = msgData._id!.toString();
        // 将用户消息设置为未读
        await socket_GroupMessageUnread({ groupId, userId: fromId, messageId });
        socket.in(groupId).emit(EventType.RECEIVE_GROUP_MESSAGE, msgData);
        socket.in(groupId).emit(EventType.GROUP_MESSAGE_UNREAD, {groupId, messageId});
      } catch(err) {
        console.log(err)
      }
    })
    /** 群聊消息已读 */
    socket.on(EventType.READ_GROUP_MESSAGE, async (data: SocketCleanGroupMessageUnreadParams) => {
      try {
        await socket_CleanGroupMessageUnread(data);
      } catch(err) {
        console.log(err)
      }
    })
    /** 接受群聊邀请 */
    socket.on(EventType.ACCEPT_GROUP_INVITE, async (data: SocketChangeGroupStatusParams) => {
      try {
        const groupNote: any = await socket_ChangeGroupNotificationStatus(data);
        const { userId: userInfo = {}, groupId } = groupNote;
        const tipMessage = await socket_SaveGroupMessage({
          groupId,
          msgType: MessageTypeEnum.TIPS,
          msgContent: `用户“${userInfo.nickname}”加入了群聊`,
          time: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'),
        });
        socket.in(groupId.toString()).emit(EventType.NEW_GROUP_USER_JOIN, tipMessage);
      } catch(err) {
        console.log(err)
      }
    })
    /** 用户退出群聊 */
    socket.on(EventType.GROUP_USER_QUIT,  async (data: SocketGroupUserQuitParams) => {
      try {
        const { userInfo, groupId } = data;
        const tipMessage = await socket_SaveGroupMessage({
          groupId,
          msgType: MessageTypeEnum.TIPS,
          msgContent: `用户“${userInfo.nickname}”退出了群聊`,
          time: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'),
        });
        socket.in(groupId.toString()).emit(EventType.GROUP_USER_QUIT, tipMessage);
      } catch(err) {
        console.log(err)
      }
    })

    // ----------- 会议 ----------------------
    /** 邀请用户参加会议 */
    socket.on(EventType.INVITE_MEETING, async (data) => {
      const { creator, meetingId, meetingName, userList } = data
      const creatorInfo = await socket_findOneUser(creator);
      userList.forEach((userId: string) => {
        const toSocketId = onlineUser.get(userId);
        toSocketId && socket.to(toSocketId).emit(EventType.INVITE_MEETING, {
          ...data,
          creator: creatorInfo
        });
      });
    })

    /** 用户拒绝参加会议 */
    socket.on(EventType.REJECT_INVITE, ({ meetingId, userId }) => {  // 通知其他成员，该用户已拒听
      socket.in(meetingId).emit(EventType.REJECT_INVITE, {userId});
    })
    /** 创建会议 */
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
    /** 用户加入会议 */
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
    /** 会议结束 */
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
    /** 离开结束 */
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
    /** 用户设备状态变更 */
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

    /** WebRTC SDP交换 */
    socket.on(EventType.SEND_OFFER, (data) => {
      const { meetingId, peerId } = data
      console.log(`[offer]peerId ${peerId}`)
      socket.to(meetingId).emit(EventType.SEND_OFFER, data);
    });
    /** WebRTC SDP交换 */
    socket.on(EventType.ANSWER_OFFER, (data) => {
      const { meetingId, peerId } = data
      console.log(`[answer]peerId ${peerId}`)
      socket.to(meetingId).emit(EventType.ANSWER_OFFER, data);
    });
    /** WebRTC ICE候选 */
    socket.on(EventType.ICE_CANDIDATE, (data)=>{
      const { meetingId } = data;
      socket.to(meetingId).emit(EventType.ICE_CANDIDATE, data);
    });
  })
}

export default socketRegister;