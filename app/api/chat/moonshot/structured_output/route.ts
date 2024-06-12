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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 提取并格式化消息历史记录。
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;

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
    const parser = StructuredOutputParser.fromZodSchema(schema);

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`${PROMPT_TEMPLATE}。回答用户输入，将输出包装在 'json' 标签里\n{formatInstructions}
      `),
      HumanMessagePromptTemplate.fromTemplate("用户的输入: {inputText}"),
    ]);

    const model = new ChatMoonshot({
      temperature: 0.8,
      model: "moonshot-v1-32k",
      apiKey: process.env.MOONSHOT_API_KEY,
    });

    const partialedPrompt = await prompt.partial({
      formatInstructions: parser.getFormatInstructions(),
    });
    const chain = partialedPrompt.pipe(model).pipe(parser);

    const result = await chain.invoke({
      history: formattedPreviousMessages,
      inputText: currentMessageContent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
