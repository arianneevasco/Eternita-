import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PolicyStorageService } from "./policy-storage.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { z } from "zod";

const createPolicySchema = z.object({
  policyText: z.string().trim().min(1).max(100_000),
});

@Controller("policies")
@UseGuards(AuthGuard)
export class PolicyController {
  constructor(private readonly policyStorage: PolicyStorageService) {}

  @Post()
  async createPolicy(
    @Req() request: any,
    @Body(new ZodValidationPipe(createPolicySchema)) body: { policyText: string },
  ) {
    return this.policyStorage.savePolicy(
      request.uid,
      body.policyText,
    );
  }

  @Get("active")
  async getActivePolicy(@Req() request: any) {
    return this.policyStorage.getActivePolicy(request.uid);
  }

  @Post(":policyId/freeze")
  async freezePolicy(
    @Req() request: any,
    @Param("policyId") policyId: string,
  ) {
    return this.policyStorage.freezePolicy(request.uid, policyId);
  }
}
