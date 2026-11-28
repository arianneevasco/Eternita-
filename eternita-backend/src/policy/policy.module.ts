import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PolicyController } from "./policy.controller";
import { PolicyStorageService } from "./policy-storage.service";
import { PolicyEvaluationService } from "./policy-evaluation.service";

@Module({
  imports: [AuthModule],
  controllers: [PolicyController],
  providers: [
    PolicyStorageService,
    PolicyEvaluationService,
  ],
  exports: [PolicyStorageService, PolicyEvaluationService]
})
export class PolicyModule {}
