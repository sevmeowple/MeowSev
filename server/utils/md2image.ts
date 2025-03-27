import MarkdownIt from "markdown-it";
import { browserManager } from "./browser";
import * as path from "path";
import * as fs from "fs";

export class MarkdownToImage {
  private md: MarkdownIt;
  private readonly css = `
    body {
      font-family: -apple-system, "Microsoft YaHei", sans-serif;
      line-height: 1.6;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
    }
    pre { background: #f6f8fa; padding: 1rem; border-radius: 4px; }
    code { font-family: "Fira Code", Consolas, monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #dfe2e5; padding: 8px; }
    img { max-width: 100%; }
  `;
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    });
    this.basePath = basePath;
    console.log("[MarkdownToImage] Base path:", this.basePath);
  }

  private setupImageRules(markdownPath?: string) {
    const basePath = markdownPath ? path.dirname(markdownPath) : process.cwd();
    console.log("[Image Rules] Base path:", basePath);
  
    this.md.renderer.rules.image = (tokens, idx) => {
      const token = tokens[idx];
      const src = token.attrs?.find((attr) => attr[0] === "src")?.[1] || "";
      console.log("[Image Process] Original src:", src);
  
      if (!src.startsWith("http") && !src.startsWith("data:")) {
        // 解码 URL 编码的文件名
        const decodedSrc = decodeURIComponent(src);
        const absolutePath = path.resolve(basePath, decodedSrc);
        console.log("[Image Process] Resolved path:", absolutePath);
  
        if (fs.existsSync(absolutePath)) {
          console.log("[Image Process] Converting image to base64:", absolutePath);
          const imageBuffer = fs.readFileSync(absolutePath);
          const base64 = imageBuffer.toString("base64");
          const ext = path.extname(decodedSrc).slice(1);
          return `<img src="data:image/${ext};base64,${base64}" alt="${token.content}">`;
        }
        console.warn("[Image Process] Image not found:", absolutePath);
      }
      return `<img src="${src}" alt="${token.content}">`;
    };
  }

  async convertToImage(
    markdown: string,
    outputPath: string,
    markdownPath?: string
  ): Promise<string> {
    console.log("[Convert] Starting conversion");
    this.setupImageRules(markdownPath);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${this.css}</style>
        </head>
        <body>${this.md.render(markdown)}</body>
      </html>
    `;

    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    await page.setContent(html);
    const height = await page.evaluate(
      () => document.documentElement.offsetHeight
    );

    await page.setViewport({
      width: 1000,
      height,
      deviceScaleFactor: 2,
    });

    await page.screenshot({
      path: outputPath,
      fullPage: true,
    });

    await page.close();
    return outputPath;
  }
  /**
   * 将 markdown 转换为图片
   * @param markdown markdown 文本
   * @param outputpath 输出路径,默认为当前目录下的 output.png
   * @param markdownPath markdown 文件路径用来解析图片路径
   */
  async markdownToImage(
    markdown: string,
    outputPath: string,
    markdownPath?: string
  ): Promise<string> {
    if (markdownPath)
      return this.convertToImage(markdown, outputPath, markdownPath);
    else return this.convertToImage(markdown, outputPath);
  }
}

// 初始化输出目录
const outputDir = path.join(process.cwd(), "data", "ai");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 导出工具函数
export async function markdownToImage(markdown: string): Promise<string> {
  const converter = new MarkdownToImage();
  const outputPath = path.join(outputDir, `${Date.now()}.png`);
  return await converter.convertToImage(markdown, outputPath);
}
