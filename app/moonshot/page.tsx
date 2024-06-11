import { PageProps } from "@/.next/types/app/page";
import { ChatWindow } from "@/components/ChatWindow";

export default function AgentsPage(props: PageProps) {
  const { searchParams } = props;
  const InfoCard = (
    <div className="p-4 md:p-8 rounded bg-[#25252d] w-full max-h-[85%] overflow-hidden">
      <h1 className="text-3xl md:text-4xl mb-4">
        ▲ Next.js + LangChain.js Moonshot
      </h1>
      <ul>
        <li>
          <a className="mr-4" href="/moonshot?mode=structured_output">
            🌕 Moonshot Chat structured_output
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
