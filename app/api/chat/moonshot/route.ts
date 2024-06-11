import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

import { ChatMoonshot } from "@langchain/community/chat_models/moonshot";
import { PROMPT_TEMPLATE, formatMessage } from "./contants";

export const runtime = "edge";

/**
 * 用于处理聊天请求的边缘运行时函数。
 *
 * 该函数接收来自用户的聊天消息，使用指定的AI模型进行处理，并返回AI的响应。
 * 它利用了Langchain和Vercel Chat的库来处理对话流程和消息格式化。
 */
export async function POST(req: NextRequest) {
  try {
    // 解析请求体中的消息数据。
    const body = await req.json();
    // 提取并格式化消息历史记录。
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    // 提取当前用户的输入消息内容。
    const currentMessageContent = messages[messages.length - 1].content;
    // 使用预定义的模板构建对话上下文。
    const prompt = PromptTemplate.fromTemplate(PROMPT_TEMPLATE);

    // 初始化ChatMoonshot模型，用于生成AI响应。
    const model = new ChatMoonshot({
      temperature: 0.8,
      model: "moonshot-v1-32k",
      apiKey: process.env.MOONSHOT_API_KEY,
    });

    // 初始化输出解析器，用于处理模型生成的响应。
    const outputParser = new HttpResponseOutputParser();

    // 构建处理链，将输入消息传递给模型并解析输出。
    const chain = prompt.pipe(model).pipe(outputParser);

    // 生成并返回流式响应。
    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"),
      input: currentMessageContent,
    });

    return new StreamingTextResponse(stream);
  } catch (e: any) {
    // 捕获并处理异常，返回错误响应。
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
