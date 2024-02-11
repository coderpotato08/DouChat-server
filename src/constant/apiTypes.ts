import { ApplyStatusEnum } from "./commonTypes"

export interface FriendNotificationsParams {
  userId: string
}
export interface LoadContactListParams extends FriendNotificationsParams {}
export interface LoadUserInfoParams extends FriendNotificationsParams {}
export interface LoadGroupListParams extends FriendNotificationsParams {}
export interface LoadGroupNotificationsParams extends FriendNotificationsParams {}

export enum GenderEnum {
  MAN = 'man',
  GIRL = 'girl',
}
export interface RegisterParams {
  nickname: string,
  username: string,
  password: string,
  gender: GenderEnum,
  avatarImage: string,
  email?: string,
  phoneNumber?: string,
}

export interface FriendStatusChangeParams {
  id: string,
  changeStatus: ApplyStatusEnum
}

export interface LoadContactParams {
  contactId: string,
}

export interface CreateGroupParams {
  groupName: string,
  groupNumber: number,
  sign: string,
  creator: string,
  users: string[],
}

export interface LoadGroupUsersParams {
  keyWord?: string
  groupId: string
}
export interface LoadGroupInfoParams extends LoadGroupUsersParams {}
export interface DisbandGroupParams extends LoadGroupUsersParams {}
export interface LoadGroupMessageListParams extends LoadGroupUsersParams {
  limitTime: Date,
}
export interface AddGroupUsersParams extends LoadGroupUsersParams {
  inviterId: string
  userList: string[],
}
export interface QuitGroupParams extends LoadGroupUsersParams {
  userId: string
}
export interface CreateGroupContactParams extends QuitGroupParams {}
export interface LoadGroupContactParams extends QuitGroupParams {}
export interface LoadAllUnreadMessageNumParams extends QuitGroupParams {}

export interface DeleteFriendParams {
  userId: string,
  friendId: string,
}
export interface AddGroupMessageUnreadParams {
  userId: string,
  groupId: string,
  messageId: string,
}
export interface CleanGroupMessageUnreadParams {
  userId: string,
  groupId: string,
  messageId?: string,
}

export interface DeleteGroupNotificationParams {
  nid: string
}
export interface DeleteFriendNotificationParams extends DeleteGroupNotificationParams {}

export interface CreateUserContactParams {
  fromId: string,
  toId: string,
}

export interface UpdateGroupInfoParams {
  groupId: string
  groupName?: string,
  sign?: string
}

export interface SearchListParams {
  userId: string,
  keyword: string,
}