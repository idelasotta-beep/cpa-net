import { LeadSource } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { mapWebhookPayload, PayloadMappingError } from "@/lib/leads/map-payload";
import { webhookPayloadSchema } from "@/lib/leads/webhook-schema";

function parse(raw: unknown) {
  return webhookPayloadSchema.parse(raw);
}

const base = {
  event: "order.created",
  store: { slug: "teleserve", name: "Teleserve", country: "CL" },
  order: {
    number: "ORD-0002",
    created_via: "shopify",
    currency: "CLP",
    total: 24990,
    utm: { source: "shopify", campaign: "" },
    customer: {
      name: "Test 5",
      surname: "Prueba",
      phone: "+56992498360",
      email: "x@y.com",
    },
    shipping: { city: "LA FLORIDA", state: "Santiago", address: "Ramon Cruz 2137" },
    items: [
      {
        product_name: "Fresh Deos Natural",
        quantity: 1,
        unit_price: 24990,
        total_price: 24990,
        dropi_product_id: "56579",
      },
    ],
  },
};

describe("mapWebhookPayload", () => {
  it("mapea el payload de EstrategiasIA a los campos del lead", () => {
    const m = mapWebhookPayload(parse(base));
    expect(m).toMatchObject({
      externalId: "ORD-0002",
      source: LeadSource.shopify,
      platformProductId: "56579",
      customerName: "Test 5 Prueba",
      customerPhone: "+56992498360",
      customerAddress: "Ramon Cruz 2137",
      customerCity: "LA FLORIDA",
      customerRegion: "Santiago",
      customerCountry: "CL",
      utmSource: "shopify",
      utmCampaign: null, // string vacío -> null
    });
  });

  it("mapea created_via 'whatsapp_ai' al source correcto", () => {
    const m = mapWebhookPayload(
      parse({ ...base, order: { ...base.order, created_via: "whatsapp_ai" } }),
    );
    expect(m.source).toBe(LeadSource.whatsapp_ai);
  });

  it("lanza PayloadMappingError ante created_via desconocido", () => {
    expect(() =>
      mapWebhookPayload(
        parse({ ...base, order: { ...base.order, created_via: "tiktok" } }),
      ),
    ).toThrow(PayloadMappingError);
  });

  it("deja platformProductId null si no hay items", () => {
    const m = mapWebhookPayload(
      parse({ ...base, order: { ...base.order, items: [] } }),
    );
    expect(m.platformProductId).toBeNull();
  });

  it("tolera null en campos opcionales (EstrategiasIA envía null, no ausencia)", () => {
    const withNulls = {
      ...base,
      order: {
        ...base.order,
        utm: { source: "shopify", campaign: null },
        customer: { ...base.order.customer, dni: null, surname: null },
        items: [
          {
            product_name: "Fresh Deos Natural",
            variant_name: null,
            quantity: 1,
            dropi_product_id: "56579",
            dropi_variation_id: null,
          },
        ],
      },
    };
    const m = mapWebhookPayload(parse(withNulls));
    expect(m.platformProductId).toBe("56579");
    expect(m.customerName).toBe("Test 5"); // surname null -> solo el nombre
    expect(m.utmCampaign).toBeNull();
  });

  it("coacciona dropi_product_id numérico a string", () => {
    const m = mapWebhookPayload(
      parse({
        ...base,
        order: {
          ...base.order,
          items: [{ ...base.order.items[0], dropi_product_id: 56579 }],
        },
      }),
    );
    expect(m.platformProductId).toBe("56579");
  });
});
