import fs from "fs/promises";
import path from "path";
import os from "os";
import { runSession, deleteSession, importSession } from "./opencode.js";
import { readConfig, writeConfig } from "./store.js";
import type { ConfigStore, ExportedMessage } from "../types.js";

const COMPACT_PROMPT = `你是一个对话压缩器。请将以下 AI 编程助手对话片段压缩为一段简洁的摘要。

要求：
1. 保留最终的决策和结论
2. 保留关键的代码变更描述
3. 保留重要的错误原因和解决方案
4. 去除中间的试错过程和重复内容
5. 使用和原始对话相同的语言

对话内容：`;

const INJECT_PROMPT = `从以下 AI 编程助手对话中提取关键知识。

要求：
1. 提取已确认的技术发现和结论
2. 提取做出的设计决策及其原因
3. 提取遇到的关键问题和解决方案
4. 忽略过程中的试错、工具调用细节
5. 输出格式：按主题分组的要点列表

对话内容：`;

export function extractMessageTexts(messages: ExportedMessage[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    const role = msg.info.role === "user" ? "User" : "Assistant";
    for (const part of msg.parts) {
      if (part.type === "text" && part.text) {
        parts.push(`[${role}]: ${part.text}`);
      }
    }
  }
  return parts.join("\n\n");
}

export async function resolveModel(modelOverride?: string): Promise<string | undefined> {
  if (modelOverride) {
    const config = await readConfig();
    if (config?.models?.[modelOverride]) {
      return config.models[modelOverride];
    }
    return modelOverride;
  }

  const config = await readConfig();
  if (config?.summarizer?.model) {
    const alias = config.summarizer.model;
    if (config.models?.[alias]) return config.models[alias];
    return alias;
  }

  return undefined;
}

export async function ensureModelConfig(): Promise<string | undefined> {
  const config = await readConfig();
  if (config?.summarizer?.model) {
    return resolveModel();
  }

  console.log("No summarizer model configured.");
  console.log("Run `ocb model <alias-or-id>` to set one, or pass --model to this command.");
  return undefined;
}

export async function summarizeMessages(
  messages: ExportedMessage[],
  modelOverride?: string
): Promise<string> {
  const text = extractMessageTexts(messages);
  const prompt = `${COMPACT_PROMPT}\n${text}`;
  const model = await resolveModel(modelOverride);

  const result = await runSession(prompt, { model, title: "ocb-summarize" });

  try {
    await deleteSession(result.sessionId);
  } catch {
    // best effort cleanup
  }

  return result.text;
}

export async function extractKnowledge(
  messages: ExportedMessage[],
  modelOverride?: string
): Promise<string> {
  const text = extractMessageTexts(messages);
  const prompt = `${INJECT_PROMPT}\n${text}`;
  const model = await resolveModel(modelOverride);

  const result = await runSession(prompt, { model, title: "ocb-extract" });

  try {
    await deleteSession(result.sessionId);
  } catch {
    // best effort cleanup
  }

  return result.text;
}
