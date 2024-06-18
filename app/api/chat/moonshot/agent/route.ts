import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";

import { ChatMoonshot } from "@langchain/community/chat_models/moonshot";
import { PROMPT_TEMPLATE, formatMessage } from "../contants";
import { HumanMessage, AIMessage, ChatMessage } from "@langchain/core/messages";
import { Calculator } from "@langchain/community/tools/calculator";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { renderTextDescriptionAndArgs } from "langchain/tools/render";

export const runtime = "edge";

/**
 * 将Vercel聊天消息转换为LangChain消息格式。
 * @param message Vercel聊天消息对象。
 * @returns 转换后的LangChain消息对象。
 */
const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content); // 用户消息
  } else if (message.role === "assistant") {
    return new AIMessage(message.content); // 助手消息
  } else {
    return new ChatMessage(message.content, message.role); // 其他角色消息
  }
};

export async function POST(req: NextRequest) {
  try {
    // 解析请求体中的消息数据。
    const body = await req.json();
    // 是否返回中间步骤
    const returnIntermediateSteps = body.show_intermediate_steps;
    // 提取并格式化消息历史记录。
    const messages = body.messages ?? [];
    // const messages = (body.messages ?? []).filter(
    //   // 过滤出用户和助手的消息
    //   (message: VercelChatMessage) =>
    //     message.role === "user" || message.role === "assistant",
    // );
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    // 提取当前用户的输入消息内容。
    const currentMessageContent = messages[messages.length - 1].content;

    // 初始化工具
    const tools = [new Calculator(), new SerpAPI(process.env.SERPAPI_API_KEY)];

    // 使用预定义的模板构建对话上下文。
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `${PROMPT_TEMPLATE}。你现在有权限使用工具，工具列表: {tools}\n`,
      ),
      HumanMessagePromptTemplate.fromTemplate("用户输入: {inputText}"),
    ]);

    // 初始化ChatMoonshot模型，用于生成AI响应。
    const model = new ChatMoonshot({
      temperature: 0.8,
      model: "moonshot-v1-32k",
      apiKey: process.env.MOONSHOT_API_KEY,
    });

    // // 创建并配置代理执行器，用于执行基于工具的任务
    // const agent = await createToolCallingAgent({
    //   llm: model,
    //   tools,
    //   prompt,
    // });

    // // 创建代理执行器，用于执行基于工具的任务链
    // const agentExecutor = new AgentExecutor({
    //   agent,
    //   tools,
    //   returnIntermediateSteps,
    // });

    // if (!returnIntermediateSteps) {
    //   // 如果不需要中间步骤，直接流式返回最终的聊天响应
    //   const logStream = await agentExecutor.streamLog({
    //     inputText: currentMessageContent,
    //     history: formattedPreviousMessages,
    //   });

    //   // 构建并返回一个可读流，仅包含模型生成的最终字符串响应
    //   const textEncoder = new TextEncoder();
    //   // 自定义可读流用于流式响应
    //   const transformStream = new ReadableStream({
    //     async start(controller) {
    //       for await (const chunk of logStream) {
    //         if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
    //           const addOp = chunk.ops[0];
    //           console.log("--- chunk", chunk);
    //           if (
    //             addOp.path.startsWith("/logs/") &&
    //             typeof addOp.value === "string" &&
    //             addOp.value.length
    //           ) {
    //             controller.enqueue(textEncoder.encode(addOp.value));
    //           }
    //         }
    //       }
    //       controller.close();
    //     },
    //   });
    //   return new StreamingTextResponse(transformStream);
    // } else {
    //   // 如果需要中间步骤，以JSON形式返回最终输出和中间步骤
    //   const result = await agentExecutor.invoke({
    //     inputText: currentMessageContent,
    //     history: formattedPreviousMessages,
    //   });
    //   return NextResponse.json(
    //     { output: result.output, intermediate_steps: result.intermediateSteps },
    //     { status: 200 },
    //   );
    // }
    // 初始化输出解析器，用于处理模型生成的响应。
    const outputParser = new HttpResponseOutputParser();

    const partialPrompt = await prompt.partial({
      tools: renderTextDescriptionAndArgs(tools),
    });
    // 构建处理链，将输入消息传递给模型并解析输出。
    const chain = partialPrompt.pipe(model).pipe(outputParser);

    // 生成并返回流式响应。
    const stream = await chain.stream({
      history: formattedPreviousMessages,
      inputText: currentMessageContent,
    });

    return new StreamingTextResponse(stream);
  } catch (e: any) {
    // 捕获并处理异常，返回错误响应。
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
