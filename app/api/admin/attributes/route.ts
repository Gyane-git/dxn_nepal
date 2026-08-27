import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { ensureUniqueSlug } from "@/lib/slug";
import { attributeSchema } from "@/schemas/admin-attribute";

export async function GET() {
  try {
    await requirePermission("attributes.view");
    const attributes = await prisma.attribute.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }] } },
    });
    return ok(attributes);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("attributes.create");
    const body = await request.json();
    const parsed = attributeSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const data = parsed.data;
    const slug = await ensureUniqueSlug(prisma.attribute, data.name);

    const attribute = await prisma.attribute.create({
      data: { name: data.name, slug, type: data.type, sortOrder: data.sortOrder },
      include: { values: true },
    });

    return ok(attribute, "Attribute created");
  } catch (error) {
    return handleApiError(error);
  }
}
