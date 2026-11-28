import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { DeathVerificationService } from "./death-verification.service";

@Controller("legacy")
@UseGuards(AuthGuard)
export class DeathReportController {
  constructor(private readonly deathVerification: DeathVerificationService) {}

  @Post("death-reports")
  submit(@Req() request: { uid: string }, @Body() body: { ownerUid: string }) {
    return this.deathVerification.submitDeathReport(body.ownerUid, request.uid);
  }
}
