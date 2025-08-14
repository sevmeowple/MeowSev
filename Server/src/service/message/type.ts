// src/service/message/types.ts
export interface CQCodeDetector {
  canHandle(rawMessage: string): boolean;
  detect(rawMessage: string): CQCodeMatch[];
}

export interface CQCodeHandler {
  handle(match: CQCodeMatch, sessionData: any): Promise<void>;
}

export interface CQCodeMatch {
  type: string;
  raw: string;
  data: any;
}

export interface CQCodeProcessor {
  detector: CQCodeDetector;
  handler: CQCodeHandler;
  name: string;
}