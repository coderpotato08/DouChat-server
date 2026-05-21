import { AIMessage, type BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  Annotation,
  Command,
  END,
  interrupt,
  isInterrupted,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { Context } from "koa";
import { v4 } from "uuid";
import { $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";
import { sleep } from "../utils/common-utils";

const ApprovalState = Annotation.Root({
  taskId: Annotation<string>,
  taskContent: Annotation<string>,
  status: Annotation<"pending" | "approved" | "rejected">,
  final_result: Annotation<string>,
  llmCalls: Annotation<number>,
  messages: MessagesAnnotation.spec.messages,
});
type ApprovalGraphState = typeof ApprovalState.State;
enum NodeType {
  PROCESS_TASK = "process_task",
  WAIT_APPROVAL = "wait_approval",
  APPROVE_NODE = "approve_node",
  REJECT_NODE = "reject_node",
}

const approvalCheckpointer = new MemorySaver();

const buildApprovalGraph = () => {
  const graph = new StateGraph(ApprovalState)
    .addNode(NodeType.PROCESS_TASK, processTask)
    .addNode(NodeType.WAIT_APPROVAL, waitApproval)
    .addNode(NodeType.APPROVE_NODE, approveNode)
    .addNode(NodeType.REJECT_NODE, rejectNode)
    .addEdge(START, NodeType.PROCESS_TASK)
    .addEdge(NodeType.PROCESS_TASK, NodeType.WAIT_APPROVAL)
    .addEdge(NodeType.APPROVE_NODE, END)
    .addEdge(NodeType.REJECT_NODE, END)
    .compile({ checkpointer: approvalCheckpointer });

  return {
    graph,
    checkpointer: approvalCheckpointer,
  };
};

let approvalAgentRuntime: ReturnType<typeof buildApprovalGraph> | null = null;

const getMessagePreview = (message: BaseMessage) => {
  if (typeof message.content === "string") {
    return message.content.slice(0, 50);
  }

  try {
    return JSON.stringify(message.content).slice(0, 50);
  } catch (_error) {
    return String(message.content).slice(0, 50);
  }
};

export const printCheckpoint = async (threadId: string, title: string) => {
  const config = { configurable: { thread_id: threadId } };
  const checkpointTuple = await approvalCheckpointer.getTuple(config);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${title}]`);
  console.log(`${"=".repeat(60)}`);

  if (!checkpointTuple) {
    console.log("  未找到 checkpoint");
    return;
  }

  const { checkpoint } = checkpointTuple;
  const channelValues = checkpoint.channel_values;

  console.log(`  Thread ID: ${threadId}`);
  console.log(`  Checkpoint ID: ${checkpoint.id}`);
  console.log(`  Timestamp: ${checkpoint.ts}`);
  console.log("\n  [Channel Values 状态]");

  for (const [key, value] of Object.entries(channelValues)) {
    if (key === "messages" && Array.isArray(value)) {
      const messages = value as BaseMessage[];
      console.log(`    messages: [${messages.length} 条消息]`);

      messages.forEach((message, index) => {
        console.log(`      [${index}] ${message.type}: ${getMessagePreview(message)}...`);
      });
      continue;
    }

    const normalizedValue =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : JSON.stringify(value);
    console.log(`    ${key}: ${normalizedValue}`);
  }

  console.log(`${"=".repeat(60)}\n`);
};

const getApprovalAgent = () => {
  if (approvalAgentRuntime) {
    return approvalAgentRuntime;
  }
  approvalAgentRuntime = buildApprovalGraph();
  return approvalAgentRuntime;
};

/** 审核流程中断demo - 节点 - processTask */
const processTask = async (state: ApprovalGraphState) => {
  await sleep(2000); // 模拟处理任务的时间
  return {
    ...state,
    final_result: `processed: ${state.taskContent}`,
    status: "approved",
  };
};

/** 审核流程中断demo - 节点 - waitApproval */
const waitApproval = (state: ApprovalGraphState) => {
  const isApproved = interrupt({
    question: "Do you want to proceed?",
    details: state.taskContent,
  });
  if (isApproved) {
    return new Command({ goto: NodeType.APPROVE_NODE });
  } else {
    return new Command({ goto: NodeType.REJECT_NODE });
  }
};

/** 审核流程中断demo - 节点 - approveNode */
const approveNode = async (state: ApprovalGraphState) => {
  return {
    ...state,
    status: "approved",
    messages: [...state.messages, new AIMessage(`任务${state.taskId}被批准, 备注：${state.taskContent}`)],
  };
};

/** 审核流程中断demo - 节点 - rejectNode */
const rejectNode = async (state: ApprovalGraphState) => {
  return {
    ...state,
    status: "rejected",
    messages: [...state.messages, new AIMessage(`任务${state.taskId}被拒绝, 原因：${state.taskContent}`)],
  };
};

/** 审核流程中断demo - 开始任务 */
export const startTask = async (ctx: Context) => {
  const { taskId, taskContent } = ctx.request.body as any;
  const { graph } = getApprovalAgent();
  const thread_id = v4();
  const initialState: ApprovalGraphState = {
    taskId,
    taskContent,
    status: "pending",
    final_result: "",
    llmCalls: 0,
    messages: [new HumanMessage(taskContent)],
  };
  const config = { configurable: { thread_id } };

  const result = graph.invoke(initialState, config);

  printCheckpoint(thread_id, "启动任务后 - 中断前");

  if (isInterrupted(result)) {
    ctx.body = createRes(
      $SuccessCode,
      { threadId: thread_id, status: "interrupted" },
      "任务已启动，等待审批"
    );
  }

  ctx.body = createRes($SuccessCode, { threadId: thread_id, status: "running" }, "success");
};

export const approvalTask = async (ctx: Context) => {
  const { threadId, approved, remark } = ctx.request.body as any;
  const { graph } = getApprovalAgent();
  const config = { configurable: { thread_id: threadId } };
  // 打印恢复前的 checkpoint
  printCheckpoint(threadId, "恢复流程前 - 检查点状态");
  // 恢复执行
  const result = graph.invoke(new Command({ resume: approved }), config);
  // 打印恢复后的 checkpoint
  printCheckpoint(threadId, "恢复流程后 - 检查点状态");
  ctx.body = createRes($SuccessCode, { status: "completed", result }, "success");
};
