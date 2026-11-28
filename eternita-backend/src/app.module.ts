import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { AccountController } from "./account/account.controller";
import { AuthModule } from "./auth/auth.module";
import { PeopleController } from "./people/people.controller";
import { DiaryModule } from "./diary/diary.module";
import { PolicyModule } from "./policy/policy.module";
import { AiModule } from "./ai/ai.module";
import { LegacyModule } from "./legacy/legacy.module";


@Module({
  imports: [AuthModule, DiaryModule, PolicyModule, AiModule, LegacyModule],
  controllers: [HealthController, AccountController, PeopleController],
})
export class AppModule {}
