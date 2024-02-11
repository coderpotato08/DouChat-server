import { MessageTypeEnum } from "../constant/commonTypes";

export const formatMessageText = (content: any, type: MessageTypeEnum): string => { // 处理左侧聊天栏最近一条消息文本
  if (content == '' && !content) return ''
  if (type === MessageTypeEnum.IMAGE || type === MessageTypeEnum.TEXT) {
    let str = content;
    str = str.replace(/<img.*?>/g, "[图片]"); // 处理图片消息
    str = str.replace(/<.*?>/g, "");
    return str
  } else if (type === MessageTypeEnum.FILE) {
    const { filename } = content;
    return `[文件] ${filename}`
  }
  return ""
}