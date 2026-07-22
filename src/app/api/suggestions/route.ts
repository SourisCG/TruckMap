import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const suggestionSchema = z.object({
  category: z.enum(["restriction", "closure", "dimension", "allowed_route", "map_error"]),
  description: z.string().trim().min(20).max(2_000),
  sourceUrl: z.union([z.url().max(500), z.literal("")]),
  contactEmail: z.union([z.email().max(200), z.literal("")]),
  location: z.object({
    lat: z.number().min(14).max(33),
    lng: z.number().min(-119).max(-86),
  }),
  turnstileToken: z.string().max(2_048).optional(),
});

const CATEGORY_LABELS = {
  restriction: "Restricción para camiones",
  closure: "Cierre o bloqueo",
  dimension: "Límite de peso o dimensiones",
  allowed_route: "Ruta permitida",
  map_error: "Error en el mapa",
};

async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export async function POST(request: NextRequest) {
  const ip = requestIp(request.headers);
  const allowed = await checkRateLimit(`suggestion:${ip}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Alcanzaste el límite de reportes." }, { status: 429 });
  }

  try {
    const input = suggestionSchema.parse(await request.json());
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      return NextResponse.json({ error: "No fue posible validar el formulario." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.SUGGESTIONS_TO_EMAIL;
    const from = process.env.SUGGESTIONS_FROM_EMAIL;
    if (!apiKey || !to || !from) {
      return NextResponse.json(
        { error: "El buzón de sugerencias todavía no está configurado." },
        { status: 503 },
      );
    }

    const mapUrl = `https://www.openstreetmap.org/?mlat=${input.location.lat}&mlon=${input.location.lng}#map=18/${input.location.lat}/${input.location.lng}`;
    const text = [
      "Nueva sugerencia para TruckMap México",
      "",
      `Categoría: ${CATEGORY_LABELS[input.category]}`,
      `Ubicación: ${input.location.lat}, ${input.location.lng}`,
      `Mapa: ${mapUrl}`,
      `Fuente indicada: ${input.sourceUrl || "No proporcionada"}`,
      `Contacto: ${input.contactEmail || "Anónimo"}`,
      "",
      "Descripción:",
      input.description,
      "",
      "Este reporte no debe publicarse sin validarlo con una fuente oficial.",
    ].join("\n");

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: [to],
      subject: `[TruckMap] ${CATEGORY_LABELS[input.category]}`,
      text,
      replyTo: input.contactEmail || undefined,
    });
    if (result.error) throw new Error(result.error.message);

    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Revisa los datos de la sugerencia." }, { status: 400 });
    }
    return NextResponse.json({ error: "No fue posible enviar la sugerencia." }, { status: 502 });
  }
}
