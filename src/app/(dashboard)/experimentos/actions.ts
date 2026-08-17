"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** landingId desde una URL *.pages.dev (el resto lo carga el usuario a mano). */
function deriveLandingId(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.endsWith(".pages.dev") ? h.slice(0, -".pages.dev".length) : "";
  } catch {
    return "";
  }
}

export async function createExperiment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  if (!name || !slug) return;
  try {
    await prisma.experiment.create({ data: { name, slug } });
  } catch {
    /* slug duplicado, etc. */
  }
  revalidatePath("/experimentos");
}

export async function addVariant(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const experimentId = String(formData.get("experimentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const landingId = String(formData.get("landingId") ?? "").trim() || deriveLandingId(url);
  const weight = Math.max(1, Math.min(99, Math.floor(Number(formData.get("weight")) || 1)));
  if (!experimentId || !name || !url || !landingId) return;
  await prisma.experimentVariant.create({ data: { experimentId, name, url, landingId, weight } });
  revalidatePath("/experimentos");
}

export async function deleteVariant(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.experimentVariant.delete({ where: { id } }).catch(() => {});
  revalidatePath("/experimentos");
}

export async function deleteExperiment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.experiment.delete({ where: { id } }).catch(() => {});
  revalidatePath("/experimentos");
}
