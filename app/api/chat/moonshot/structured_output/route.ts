import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { PROMPT_TEMPLATE, formatMessage } from "../contants";
import { ChatMoonshot } from "@langchain/community/chat_models/moonshot";
import { StructuredOutputParser } from "langchain/output_parsers";

export const runtime = "edge";

/**
 * 处理POST请求，用于与Chatbot进行交互。
 * @param req Next.js的请求对象，包含请求信息和功能。
 * @returns 返回一个JSON响应，包含Chatbot的回复或错误信息。
 */
export async function POST(req: NextRequest) {
  try {
    // 解析请求体中的JSON数据，获取消息内容。
    const body = await req.json();
    // 提取消息历史记录。
    // 提取并格式化消息历史记录。
    const messages = body.messages ?? [];
    // 格式化除最新消息外的历史消息。
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    // 获取最新的消息内容。
    const currentMessageContent = messages[messages.length - 1].content;

    // 定义解析输出的schema，用于结构化Chatbot的响应。
    const schema = z.object({
      tone: z
        .enum(["positive", "negative", "neutral"])
        .describe("The overall tone of the input"),
      entity: z.string().describe("The entity mentioned in the input"),
      word_count: z.number().describe("The number of words in the input"),
      chat_response: z.string().describe("A response to the human's input"),
      final_punctuation: z
        .optional(z.string())
        .describe("The final punctuation mark in the input, if any."),
    });
    // 根据schema创建解析器。
    const parser = StructuredOutputParser.fromZodSchema(schema);

    // 创建提示模板，用于构建Chatbot的输入。
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`${PROMPT_TEMPLATE}。回答用户输入，将输出包装在 'json' 标签里\n{formatInstructions}
      `),
      HumanMessagePromptTemplate.fromTemplate("用户的输入: {inputText}"),
    ]);

    // 初始化Chatbot模型。
    const model = new ChatMoonshot({
      temperature: 0.8,
      model: "moonshot-v1-32k",
      apiKey: process.env.MOONSHOT_API_KEY,
    });

    // 部分填充提示，注入格式化指令。
    const partialedPrompt = await prompt.partial({
      formatInstructions: parser.getFormatInstructions(),
    });
    // 创建处理链，用于依次处理提示、模型和解析器。
    const chain = partialedPrompt.pipe(model).pipe(parser);

    // 调用处理链，传入历史消息和当前消息，获取Chatbot的响应。
    const result = await chain.invoke({
      history: formattedPreviousMessages,
      inputText: currentMessageContent,
    });

    // 返回Chatbot的响应作为JSON格式的响应。
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    // 如果发生错误，返回错误信息作为JSON格式的响应。
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
