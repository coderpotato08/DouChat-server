export interface FriendNotificationsParams {
  userId: string
}
export interface LoadContactListParams extends FriendNotificationsParams {}
export interface LoadUserInfoParams extends FriendNotificationsParams {}
export interface LoadGroupListParams extends FriendNotificationsParams {}

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
  changeStatus: 0 | 1 | 2
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
  groupId: string
}
export interface DisbandGroupParams extends LoadGroupUsersParams {}
export interface LoadGroupMessageListParams extends LoadGroupUsersParams {}

export interface QuitGroupParams extends LoadGroupUsersParams {
  userId: string
}
export interface CreateGroupContactParams extends QuitGroupParams {}
export interface LoadGroupContactParams extends QuitGroupParams {}

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