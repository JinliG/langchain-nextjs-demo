import { PageProps } from "@/.next/types/app/page";
import { ChatWindow } from "@/components/ChatWindow";

const featureTextMap = {
  standard: "聊天",
  structured_output: "结构化输出",
} as any;

export default function AgentsPage(props: PageProps) {
  const { searchParams } = props;
  const currentMode = searchParams.mode || "standard";

  const InfoCard = (
    <div className="p-4 md:p-8 rounded bg-[#25252d] w-full max-h-[85%] overflow-hidden">
      <h1 className="text-3xl md:text-4xl mb-4">
        ▲ Next.js + LangChain.js + Moonshot
      </h1>
      <h2 className="text-2xl mb-3">{featureTextMap[currentMode]}功能</h2>
      <ul>
        <li>
          <a className="mr-4" href="/moonshot">
            🌕 Moonshot Chat 聊天
          </a>
        </li>
        <li>
          <a className="mr-4" href="/moonshot?mode=structured_output">
            🌕 Moonshot Chat 结构化输出
          </a>
        </li>
        <li>
          <a className="mr-4" href="/moonshot?mode=agent">
            🌕 Moonshot Chat 默认AgentTools
          </a>
        </li>
      </ul>
    </div>
  );
  return (
    <ChatWindow
      endpoint={`api/chat/moonshot${
        searchParams.mode ? `/${searchParams.mode}` : ""
      }`}
      emptyStateComponent={InfoCard}
      placeholder="请输入"
      titleText="月之暗面模型"
      emoji="🌕"
    ></ChatWindow>
  );
}
