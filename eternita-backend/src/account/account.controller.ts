import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { getDb } from "../config/firebase";
import { initializeFirebase } from "../config/firebase";
import { AuthGuard } from "../auth/auth.guard";
import { RegisterOwnerDto } from "./dto/register-owner.dto";

@Controller("auth")
export class AccountController {
  @Post("register-owner")
  async registerOwner(@Body() body: RegisterOwnerDto) {
    initializeFirebase();
    const { getAuth } = await import("firebase-admin/auth");
    const auth = getAuth();
    let user: Awaited<ReturnType<typeof auth.createUser>>;

    try {
      user = await auth.createUser({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/email-already-exists") {
        throw new ConflictException("An account with this email already exists.");
      }
      if (code === "auth/invalid-email" || code === "auth/weak-password") {
        throw new BadRequestException("The email or password is invalid.");
      }
      throw error;
    }

    const db = getDb();
    const uid = user.uid;
    const userRef = db.collection("users").doc(uid);
    const now = new Date();
    const handle = body.email
      .split("@", 1)[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "") || uid;

    let profileCreated = false;
    try {
      await userRef.create({
        role: "owner",
        name: body.displayName,
        handle,
        deceased: false,
        settings: {
          reminderTime: "20:00",
          autoLockMinutes: 5,
          darkMode: false,
        },
        lastSeq: 0,
        lastHash: "0".repeat(64),
        createdAt: now,
      });
      profileCreated = true;

      await userRef.collection("activity").add({
        action: "registerOwner",
        at: now,
      });
    } catch (error) {
      if (profileCreated) {
        await userRef.delete().catch(() => undefined);
      }
      await auth.deleteUser(uid).catch(() => undefined);
      throw error;
    }

    return {
      uid,
      role: "owner",
      name: body.displayName,
      handle,
    };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() request: any) {
    const db = getDb();
    const uid = request.uid;

    const snapshot = await db.collection("users").doc(uid).get();

    if (!snapshot.exists) {
      return {
        error: "Register an Alaala profile first",
      };
    }

    const profile = snapshot.data();

    return {
      uid,
      role: profile?.role,
      name: profile?.name,
      handle: profile?.handle,
      settings: profile?.settings,
    };
  }
}
