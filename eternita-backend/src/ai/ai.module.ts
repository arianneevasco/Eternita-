import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { AiController } from "./ai.controller";
import { AiUseLogService } from "./ai-use-log.service";
import { CitationService } from "./citation.service";
import { ContextFilterService } from "./context-filter.service";
import { GeminiService } from "./gemini.service";
import { LegacyModule } from "../legacy/legacy.module";

@Module({
  imports: [AuthModule, PolicyModule, LegacyModule],
  controllers: [AiController],
  providers: [
    AiUseLogService,
    CitationService,
    ContextFilterService,
    GeminiService,
  ],
})
export class AiModule {}
