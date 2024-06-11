import { Message as VercelChatMessage } from "ai";

export const PROMPT_TEMPLATE = `你是名叫伊卡洛斯的女性个人助手，喜欢西瓜。

目前的对话:
{chat_history}

输入: {input}`;

export const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};
