import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkRole } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { buildCategoryTree } from "../../../../lib/game-state";
import { prisma } from "../../../../lib/prisma";

// 一级仓库（档案）的增删改查仅限顶级管理员（ADMIN）
const createSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

const patchSchema = createSchema.partial().extend({
  id: z.string().min(1)
});

const deleteSchema = z.object({
  id: z.string().min(1)
});

async function requireTopAdmin() {
  const result = await checkRole(["ADMIN"]);
  if (!result.ok) {
    return fail(result.status === 401 ? "请先登录" : "仅顶级管理员可操作一级仓库", result.status);
  }
  return null;
}

export async function GET() {
  const denied = await requireTopAdmin();
  if (denied) return denied;
  return ok({ archives: await buildCategoryTree() });
}

export async function POST(request: Request) {
  try {
    const denied = await requireTopAdmin();
    if (denied) return denied;
    const input = createSchema.parse(await request.json());
    const count = await prisma.wordArchive.count();
    await prisma.wordArchive.create({
      data: { name: input.name, sortOrder: (count + 1) * 10 }
    });
    return ok({ archives: await buildCategoryTree() }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await requireTopAdmin();
    if (denied) return denied;
    const input = patchSchema.parse(await request.json());
    const { id, ...data } = input;
    await prisma.wordArchive.update({ where: { id }, data });
    return ok({ archives: await buildCategoryTree() });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireTopAdmin();
    if (denied) return denied;
    const { id } = deleteSchema.parse(await request.json());
    // 先删词条（受 GameCard 外键限制可能失败），再删档案（级联其下分类与房间题库选择）
    await prisma.$transaction([
      prisma.wordEntry.deleteMany({ where: { category: { archiveId: id } } }),
      prisma.wordArchive.delete({ where: { id } })
    ]);
    return ok({ archives: await buildCategoryTree() });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003" || error.code === "P2014") {
      return fail("该仓库下有词条正被对局记录引用，无法删除；可先停用这些词条或解散相关房间。", 409);
    }
    if (error.code === "P2002") {
      return fail("已存在同名仓库", 409);
    }
  }
  return handleApiError(error);
}
