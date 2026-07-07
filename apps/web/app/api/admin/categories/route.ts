import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkRole } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { buildCategoryTree } from "../../../../lib/game-state";
import { prisma } from "../../../../lib/prisma";

// 二级分类的增删改查：顶级管理员或管理员（ADMIN / WORD_EDITOR）
const createSchema = z.object({
  archiveId: z.string().min(1),
  name: z.string().trim().min(1).max(60)
});

const patchSchema = z.object({
  id: z.string().min(1),
  archiveId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60).optional()
});

const deleteSchema = z.object({
  id: z.string().min(1)
});

async function requireEditor() {
  const result = await checkRole(["ADMIN", "WORD_EDITOR"]);
  if (!result.ok) {
    return fail(result.status === 401 ? "请先登录" : "无权限操作题库", result.status);
  }
  return null;
}

export async function GET() {
  const denied = await requireEditor();
  if (denied) return denied;
  return ok({ archives: await buildCategoryTree(true) });
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const input = createSchema.parse(await request.json());
    const count = await prisma.wordCategory.count({ where: { archiveId: input.archiveId } });
    await prisma.wordCategory.create({
      data: {
        archiveId: input.archiveId,
        name: input.name,
        sortOrder: (count + 1) * 10
      }
    });
    return ok({ archives: await buildCategoryTree(true) }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const input = patchSchema.parse(await request.json());
    const { id, ...data } = input;
    await prisma.wordCategory.update({ where: { id }, data });
    return ok({ archives: await buildCategoryTree(true) });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const { id } = deleteSchema.parse(await request.json());
    // 先删该分类下的词条（受 GameCard 外键限制可能失败），再删分类（级联房间题库选择）
    await prisma.$transaction([
      prisma.wordEntry.deleteMany({ where: { wordCategoryId: id } }),
      prisma.wordCategory.delete({ where: { id } })
    ]);
    return ok({ archives: await buildCategoryTree(true) });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003" || error.code === "P2014") {
      return fail("该分类下有词条正被对局记录引用，无法删除；可先停用这些词条或解散相关房间。", 409);
    }
    if (error.code === "P2002") {
      return fail("同一仓库下已存在同名分类", 409);
    }
  }
  return handleApiError(error);
}
