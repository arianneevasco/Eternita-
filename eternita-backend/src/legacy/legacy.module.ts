import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LegacyController } from "./legacy.controller";
import { LegacyService } from "./legacy.service";
import { DeathReportController } from "./death-report.controller";
import { DeathVerificationService } from "./death-verification.service";
import { getDb } from "../config/firebase";

@Module({
  imports: [AuthModule],
  controllers: [LegacyController, DeathReportController],
  providers: [
    { provide: LegacyService, useFactory: () => new LegacyService(getDb()) },
    { provide: DeathVerificationService, useFactory: () => new DeathVerificationService(getDb()) },
  ],
  exports: [LegacyService],
})
export class LegacyModule {}
