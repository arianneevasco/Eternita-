import { Injectable } from "@nestjs/common";
import { getDb } from "../config/firebase";
import { buildAiUseLogDocument } from "./ai-log";

export interface AiUseLogInput {
  authenticatedUserUid: string;
  requestTimestamp: Date;
  promptCategory: string;
  promptLength: number;
  promptHash: string;
  tokenUsage?: unknown;
  selectedEntryIds: string[];
  accessLevels: Record<string, string>;
  modelName: string;
  responseStatus: "success" | "denied" | "error";
  latencyMs: number;
  error?: string;
}

@Injectable()
export class AiUseLogService {
  async writeLog(input: AiUseLogInput): Promise<void> {
    await getDb()
      .collection("users")
      .doc(input.authenticatedUserUid)
      .collection("aiUseLogs")
      .add(buildAiUseLogDocument(input));
  }
}
