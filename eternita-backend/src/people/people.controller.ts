import {Body,Controller,
Get,Param,Post,Req,UseGuards,
} from "@nestjs/common";
import { getDb } from "../config/firebase";
import { AuthGuard } from "../auth/auth.guard";

interface CreateInviteDto {
  handle: string;
  name: string;
}

interface JoinDto {
  code: string;
  name: string;
}

@Controller()
@UseGuards(AuthGuard)
export class PeopleController {
  @Post("invites")
  async createInvite(
    @Req() request: any,
    @Body() body: CreateInviteDto
  ) {
    const db = getDb();
    const ownerUid = request.uid;

    const code = Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    const inviteRef = await db
      .collection("invites")
      .add({
        ownerUid,
        code,
        handle: body.handle,
        name: body.name,
        status: "pending",
        createdAt: new Date(),
        expiresAt,
      });

    return {
      inviteId: inviteRef.id,
      code,
      handle: body.handle,
      name: body.name,
      expiresAt,
    };
  }

  @Post("auth/join")
  async join(
    @Req() request: any,
    @Body() body: JoinDto
  ) {
    const db = getDb();
    const uid = request.uid;

    return db.runTransaction(async (transaction) => {
      const invites = await transaction.get(
        db
          .collection("invites")
          .where("code", "==", body.code)
          .where("status", "==", "pending")
          .limit(1),
      );

      if (invites.empty) {
        return {
          error: "Invalid or already used invitation code",
        };
      }

      const invite = invites.docs[0];
      const inviteData = invite.data();
      const now = new Date();
      const expiresAt = typeof inviteData.expiresAt?.toDate === "function"
        ? inviteData.expiresAt.toDate()
        : new Date(inviteData.expiresAt);

      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
        return {
          error: "Invitation expired",
        };
      }

      const userRef = db.collection("users").doc(uid);
      const userSnapshot = await transaction.get(userRef);

      if (userSnapshot.exists) {
        return {
          error: "This account already has an Alaala profile",
        };
      }

      transaction.create(userRef, {
        role: "recipient",
        ownerUid: inviteData.ownerUid,
        name: body.name,
        handle: inviteData.handle,
        deceased: false,
        settings: {
          reminderTime: "20:00",
          autoLockMinutes: 5,
          darkMode: false,
        },
        createdAt: now,
      });

      transaction.update(invite.ref, {
        status: "used",
        usedByUid: uid,
        usedAt: now,
      });

      return {
        uid,
        role: "recipient",
        ownerUid: inviteData.ownerUid,
        name: body.name,
        handle: inviteData.handle,
      };
    });
  }

  @Get("people")
  async getPeople(@Req() request: any) {
    const db = getDb();
    const ownerUid = request.uid;

    const snapshot = await db
      .collection("users")
      .where("ownerUid", "==", ownerUid)
      .get();

    const people = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        role: data.role,
        ownerUid: data.ownerUid,
        name: data.name,
        handle: data.handle,
      };
    });

    return { people };
  }
}
