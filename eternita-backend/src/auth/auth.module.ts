import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { FirebaseAuthService } from "./firebase-auth.service";

@Module({
  providers: [AuthGuard, FirebaseAuthService],
  exports: [AuthGuard, FirebaseAuthService],
})
export class AuthModule {}
