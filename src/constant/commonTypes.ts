export enum MessageTypeEnum {
  TEXT, // 文本 0
  IMAGE,  // 图片 1
  VIDEO,  // 视频 2
  FILE, // 文件 3
  TIPS = 99,  // 提示（入群，邀请用户等）99
}

export enum ApplyStatusEnum {
  APPLYING,
  ACCEPT,
  REJECTED,
}
