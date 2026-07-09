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

// 剥离 assistant 消息中的 <thinking>...</thinking> 思考过程标签，剥离后为空则返回 null
export const stripThinkingTags = (content: string | null): string | null => {
  if (!content) {
    return content;
  }
  const stripped = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return stripped.length > 0 ? stripped : null;
}

export const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time)) //   sleep