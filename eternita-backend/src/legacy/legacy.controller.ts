import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { LegacyService } from "./legacy.service";

@Controller("legacy")
@UseGuards(AuthGuard)
export class LegacyController {
  constructor(private readonly legacyService: LegacyService) {}

  @Post("request")
  async requestAccess(
    @Req() request: { uid: string },
    @Body() body: { ownerUid: string },
  ) {
    return this.legacyService.requestLegacyAccess(
      body.ownerUid,
      request.uid,
    );
  }

  @Get("status/:ownerUid")
  async getStatus(
    @Req() request: { uid: string },
    @Param("ownerUid") ownerUid: string,
  ) {
    return this.legacyService.getLegacyRequestStatus(
      ownerUid,
      request.uid,
    );
  }

  @Post("requests/:requestId/approve")
  approve(@Req() request: { uid: string }, @Param("requestId") requestId: string) {
    return this.legacyService.approveLegacyRequest(requestId, request.uid);
  }

  @Post("requests/:requestId/deny")
  deny(@Req() request: { uid: string }, @Param("requestId") requestId: string) {
    return this.legacyService.denyLegacyRequest(requestId, request.uid);
  }

  @Post("requests/:requestId/activate")
  activate(@Req() request: { uid: string }, @Param("requestId") requestId: string) {
    return this.legacyService.activateLegacyRequest(requestId, request.uid);
  }

  @Post("requests/:requestId/revoke")
  revoke(@Req() request: { uid: string }, @Param("requestId") requestId: string) {
    return this.legacyService.revokeLegacyRequest(requestId, request.uid);
  }

  @Post("requests/:requestId/cancel")
  cancel(@Req() request: { uid: string }, @Param("requestId") requestId: string) {
    return this.legacyService.cancelLegacyRequest(requestId, request.uid);
  }
}
