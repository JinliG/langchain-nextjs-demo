import { NextRequest, NextResponse } from "next/server"; // 引入Next.js的请求和响应模块
import { Message as VercelChatMessage, StreamingTextResponse } from "ai"; // 引入AI模块的消息定义和流式文本响应

// 导入LangChain库中的代理执行器和创建工具调用代理的函数
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai"; // 引入OpenAI的聊天模型
import { SerpAPI } from "@langchain/community/tools/serpapi"; // 引入SerpAPI工具用于搜索引擎查询
import { Calculator } from "@langchain/community/tools/calculator"; // 引入计算器工具
import { AIMessage, ChatMessage, HumanMessage } from "@langchain/core/messages"; // 引入消息类型

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts"; // 引入构建聊天提示模板的工具

/**
 * 指定运行时环境为边缘计算。
 */
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

/**
 * 定义代理系统的默认提示模板，模拟一只会说话的鹦鹉的回复风格。
 */
const AGENT_SYSTEM_TEMPLATE = `您是一只名叫Polly的会说话的鹦鹉。所有最终回复都应模仿鹦鹉的说话方式。经常嘎嘎叫！`;

/**
 * 处理POST请求的异步函数，初始化并调用OpenAI代理处理聊天信息。
 * @param req Next.js的请求对象。
 * @returns 代理处理后的响应。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // 解析请求体
    const messages = (body.messages ?? []).filter(
      // 过滤出用户和助手的消息
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    );
    const returnIntermediateSteps = body.show_intermediate_steps; // 是否返回中间步骤
    const previousMessages = messages
      .slice(0, -1)
      .map(convertVercelMessageToLangChainMessage); // 转换历史消息
    const currentMessageContent = messages[messages.length - 1].content; // 当前消息内容

    // 初始化工具和聊天模型
    const tools = [new Calculator(), new SerpAPI()]; // 工具集合
    const chat = new ChatOpenAI({
      modelName: "gpt-3.5-turbo-1106", // 使用的模型名称
      temperature: 0, // 创造性温度设置为0，以获得更确定的回复
      streaming: true, // 启用流式输出
    });

    // 创建聊天提示模板，用于构建与代理交互的对话历史
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", AGENT_SYSTEM_TEMPLATE], // 系统提示信息
      new MessagesPlaceholder("chat_history"), // 对话历史占位符
      ["human", "{input}"], // 用户输入占位符
      new MessagesPlaceholder("agent_scratchpad"), // 代理草稿区占位符
    ]);

    // 创建并配置代理执行器，用于执行基于工具的任务
    const agent = await createToolCallingAgent({
      llm: chat,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      returnIntermediateSteps, // 是否在输出中包含中间步骤
    });

    // 根据是否需要返回中间步骤，选择不同的响应处理方式
    if (!returnIntermediateSteps) {
      // 如果不需要中间步骤，直接流式返回最终的聊天响应
      const logStream = await agentExecutor.streamLog({
        input: currentMessageContent,
        chat_history: previousMessages,
      });

      // 构建并返回一个可读流，仅包含模型生成的最终字符串响应
      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of logStream) {
            if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
              const addOp = chunk.ops[0];
              if (
                addOp.path.startsWith("/logs/ChatOpenAI") &&
                typeof addOp.value === "string" &&
                addOp.value.length
              ) {
                controller.enqueue(textEncoder.encode(addOp.value));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      // 如果需要中间步骤，以JSON形式返回最终输出和中间步骤
      const result = await agentExecutor.invoke({
        input: currentMessageContent,
        chat_history: previousMessages,
      });
      return NextResponse.json(
        { output: result.output, intermediate_steps: result.intermediateSteps },
        { status: 200 },
      );
    }
  } catch (e: any) {
    // 处理异常情况，返回错误信息
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
