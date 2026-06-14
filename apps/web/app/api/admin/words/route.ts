import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkRole } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

// 词条（文本标签）的增删改查：顶级管理员或管理员（ADMIN / WORD_EDITOR）
const createSchema = z.object({
  wordCategoryId: z.string().min(1),
  textCn: z.string().trim().min(1),
  textEnOrNote: z.string().trim().max(120).optional().default(""),
  enabled: z.boolean().default(true)
});

const patchSchema = z.object({
  id: z.string().min(1),
  wordCategoryId: z.string().min(1).optional(),
  textCn: z.string().trim().min(1).optional(),
  textEnOrNote: z.string().trim().max(120).optional(),
  enabled: z.boolean().optional()
});

const deleteSchema = z.object({
  id: z.string().min(1)
});

const wordSelect = {
  id: true,
  wordCategoryId: true,
  textCn: true,
  textEnOrNote: true,
  enabled: true,
  sourceSheet: true,
  sourceRow: true,
  category: {
    select: {
      id: true,
      name: true,
      archive: { select: { id: true, name: true } }
    }
  }
} as const;

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
  const words = await prisma.wordEntry.findMany({
    select: wordSelect,
    orderBy: [{ category: { archive: { sortOrder: "asc" } } }, { category: { sortOrder: "asc" } }, { textCn: "asc" }]
  });
  return ok({ words });
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const input = createSchema.parse(await request.json());
    const word = await prisma.wordEntry.create({
      data: input,
      select: wordSelect
    });
    return ok(word, { status: 201 });
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
    const word = await prisma.wordEntry.update({
      where: { id },
      data,
      select: wordSelect
    });
    return ok(word);
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const { id } = deleteSchema.parse(await request.json());
    await prisma.wordEntry.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003" || error.code === "P2014") {
      return fail("该词条已被对局记录引用，无法删除；可改为「停用」。", 409);
    }
  }
  return handleApiError(error);
}
