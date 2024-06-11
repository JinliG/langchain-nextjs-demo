import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputFunctionsParser } from "@langchain/core/output_parsers/openai_functions";
import { PROMPT_TEMPLATE, formatMessage } from "../contants";
import { ChatMoonshot } from "@langchain/community/chat_models/moonshot";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 提取并格式化消息历史记录。
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;

    const prompt = PromptTemplate.fromTemplate(PROMPT_TEMPLATE);
    /**
     * Function calling is currently only supported with ChatOpenAI models
     */
    // const model = new ChatOpenAI({
    //   temperature: 0.8,
    //   modelName: "gpt-3.5-turbo-1106",
    // });

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

    const model = new ChatMoonshot({
      temperature: 0.8,
      model: "moonshot-v1-32k",
      apiKey: process.env.MOONSHOT_API_KEY,
    });

    /**
     * We use Zod (https://zod.dev) to define our schema for convenience,
     * but you can pass JSON Schema directly if desired.
     */

    /**
     * Bind the function and schema to the OpenAI model.
     * Future invocations of the returned model will always use these arguments.
     *
     * Specifying "function_call" ensures that the provided function will always
     * be called by the model.
     */
    const functionCallingModel = model.bind({
      // @ts-ignore
      functions: [
        {
          name: "output_formatter",
          description: "Should always be used to properly format output",
          parameters: zodToJsonSchema(schema),
        },
      ],
      function_call: { name: "output_formatter" },
    });

    /**
     * Returns a chain with the function calling model.
     */
    const chain = prompt
      .pipe(functionCallingModel)
      .pipe(new JsonOutputFunctionsParser());

    const result = await chain.invoke({
      chat_history: formattedPreviousMessages,
      input: currentMessageContent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
