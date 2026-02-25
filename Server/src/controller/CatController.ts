import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { HelpRegistry } from "../utils/HelpRegistry";
import { MessageObject, SessionData, getUserDisplayName } from "../utils/message";
import { CatService } from "../service/CatService";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import CatCard from "../view/CatCard";

RouteRegistry.registerBatch(['cat']);

HelpRegistry.register({
  command: 'cat',
  description: '生成你的专属猫猫头像',
  usage: 'cat',
  examples: ['cat'],
  details: '根据你的用户ID确定性生成一只独一无二的SVG猫猫，相同ID永远生成同一只猫。'
});

const catService = new CatService();

export const catController = new Elysia()
  .post("/cat", async ({ body }): Promise<MessageObject> => {
    const { session } = body as { session: SessionData };

    if (!session) {
      return { type: "text", content: "❌ 无法获取会话信息" };
    }

    try {
      const userId = session.user.id;
      const userName = getUserDisplayName(session);
      const { svg, traits } = catService.generateCat(userId);

      const traitLabels = [
        CatService.HEAD_NAMES[traits.headType],
        CatService.EAR_NAMES[traits.earType],
        CatService.EYE_NAMES[traits.eyeType],
        CatService.MOUTH_NAMES[traits.mouthType],
        CatService.BODY_NAMES[traits.bodyType],
        CatService.TAIL_NAMES[traits.tailType],
      ];

      const paletteName = catService.getPaletteName(traits.paletteIndex);
      const patternName = CatService.PATTERN_NAMES[traits.patternType];

      const picPath = await tsxToPic(CatCard, {
        svgString: svg,
        userName,
        traitLabels,
        paletteName,
        patternName,
      }, { width: 500 });

      return { type: "image", src: `file://${picPath}` } as MessageObject;
    } catch (error) {
      console.error("猫猫生成失败:", error);
      return { type: "text", content: "❌ 猫猫生成失败，请稍后重试" };
    }
  });
