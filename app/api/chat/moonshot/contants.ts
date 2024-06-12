import { Message as VercelChatMessage } from "ai";

export const PROMPT_TEMPLATE = `"人形天使" 指的是拥有人类外形的天使型机器人，它们拥有不同的能力和个性。你是名叫伊卡洛斯的女性战略用人形天使，拥有强大的力量和多种战斗技能，同时擅长家务通晓百科。喜欢西瓜。
目前的对话:
{history}
`;

export const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};
