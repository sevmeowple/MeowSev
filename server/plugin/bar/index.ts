import { axiosInstance } from "@utils/axios";
import { browserManager } from "@utils/browser";
import { MarkdownToImage, markdownToImage } from "@utils/md2image";
import { turndown } from "@utils/turndown";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { systemPrompt_R1 } from "./prom";

import { Logger } from "@utils/logger";
// import * as axios from "axios";
// import * as turndown from "turndown";

dotenv.config({ path: __dirname + "/.env.local" });

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SILICON_API_KEY = process.env.SILICON_API_KEY;

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: DEEPSEEK_API_KEY,
});

const silicon = new OpenAI({
  baseURL:"https://api.siliconflow.cn/v1",
  apiKey: SILICON_API_KEY
})

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

const googleai = new GoogleGenerativeAI(GOOGLE_API_KEY as string);

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

class Bar {
  baseURL = "https://api.deepseek.com";
  groqURL = "https://api.groq.com/openai/v1";
  dir: string = path.join(process.cwd(), "data", "bar");
  prompt_path: string = path.join(process.cwd(), "plugin", "bar", "prompt");
  prompt: string = systemPrompt_R1;

  constructor() {
    // 检查目录是否存在
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  async chat_Bar(message: string, char: string, on: boolean) {
    console.log("bun calling chat_Bar");
    const charprompt_path = this.prompt_path + "/" + char + ".md";
    let charprompt = "";
    if (!fs.existsSync(charprompt_path)) {
      console.log("bun no char prompt");
      return "No char";
    } else {
      charprompt = fs.readFileSync(charprompt_path).toString();
    }
    let completion;
    completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: charprompt ? charprompt : this.prompt },
        { role: "user", content: message },
      ],
      model: "deepseek-reasoner",
    });
    // console.log("bun completion", completion);
    if (!completion) {
      console.log("bun openai completion is null now try silicon");
      completion = await silicon.chat.completions.create({
        messages: [
          { role: "system", content: charprompt ? charprompt : this.prompt },
          { role: "user", content: message },
        ],
        model: "deepseek-ai/DeepSeek-R1",
      });
      if(!completion)
      {
        console.log("bun silicon completion is null now try google");
        const flash = googleai.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: charprompt ? charprompt : this.prompt,
        });
        const chatsession = flash.startChat({
          generationConfig,
          history: [],
        });
        return await markdownToImage(
          (await chatsession.sendMessage(message)).response.text()
        );
      }
    }

    let reasoning_content = "";

    // console.log(completion);
    return await markdownToImage(
      completion.choices[0].message.content as string
    );
  }
}

export const bar = new Bar();
