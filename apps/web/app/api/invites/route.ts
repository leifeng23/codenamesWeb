import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "../../../lib/auth";
import { handleApiError, ok } from "../../../lib/api";
import { prisma } from "../../../lib/prisma";

const schema = z.object({
  expiresAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const input = schema.parse(await request.json().catch(() => ({})));
    const invite = await prisma.inviteCode.create({
      data: {
        code: randomBytes(5).toString("hex").toUpperCase(),
        createdById: user.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
      }
    });
    return ok(invite, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
