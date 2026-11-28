import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DiaryController } from "./diary.controller";
import { DiaryService } from "./diary.service";
import { HashChainService } from "./hash-chain.service";
import { PolicyModule } from "../policy/policy.module";
import { LegacyModule } from "../legacy/legacy.module";

@Module({
  imports: [AuthModule, PolicyModule, LegacyModule],
  controllers: [DiaryController],
  providers: [
    DiaryService,
    HashChainService,
  ],
})
export class DiaryModule {}
