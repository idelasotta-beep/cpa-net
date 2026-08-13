import { describe, expect, it } from "vitest";
import { mapShopifyOrder } from "../map-shopify-order";
import { PayloadMappingError } from "../map-payload";
import { shopifyOrderSchema } from "../shopify-webhook-schema";

// Basado en el JSON crudo real del webhook orders/create (prueba 2026-08-12).
function baseOrder(overrides: Record<string, unknown> = {}) {
  return shopifyOrderSchema.parse({
    id: 7197082386682,
    app_id: 5690175,
    name: "GG1003",
    order_number: 1003,
    email: "cliente@example.com",
    phone: "+5493814572504",
    currency: "ARS",
    total_price: "21990.00",
    note: null,
    note_attributes: [
      { name: "Nombre completo", value: "Prueba Test" },
      { name: "Calle", value: "Ramón Cruz Montt" },
      { name: "Número", value: "2137" },
      { name: "Piso y Timbre", value: "Piso 3" },
      { name: "Referencia del Domicilio", value: "entre X e Y" },
      { name: "Provincia", value: "Formosa" },
      { name: "Ciudad", value: "Campo Rigonato" },
      { name: "Código postal", value: "3606" },
      { name: "Teléfono con Whatsapp", value: "5493814572504" },
      { name: "Correo electrónico", value: "cliente@example.com" },
      { name: "IP address", value: "2803:c600:d219:8139:3865:62a1:a7fd:bf8e" },
    ],
    shipping_address: {
      name: "Prueba Test",
      address1: "Ramón Cruz Montt",
      address2: "2137",
      city: "Campo Rigonato",
      zip: "3606",
      province: "Formosa",
      province_code: "P",
      country: "Argentina",
      country_code: "AR",
      phone: "+5493814572504",
    },
    line_items: [{ sku: "SKU-P90", quantity: 1, price: "21990.00" }],
    ...overrides,
  });
}

describe("mapShopifyOrder", () => {
  it("mapea los campos base desde shipping_address + extras de note_attributes", () => {
    const m = mapShopifyOrder(baseOrder());
    expect(m).toMatchObject({
      externalId: "7197082386682",
      platform: "shopify",
      channel: "shopify",
      platformProductId: "SKU-P90",
      customerName: "Prueba Test",
      customerPhone: "5493814572504", // sin "+"
      customerEmail: "cliente@example.com",
      customerStreet: "Ramón Cruz Montt",
      customerStreetNumber: "2137",
      customerCity: "Campo Rigonato",
      customerPostalCode: "3606",
      customerProvinceId: 9, // Formosa via province_code "P"
      customerCountry: "Argentina",
      customerFloor: "Piso 3",
      customerBetweenStreets: "entre X e Y",
      customerIp: "2803:c600:d219:8139:3865:62a1:a7fd:bf8e",
      quantity: 1,
      totalPriceLocal: 21990,
    });
  });

  it("captura la cantidad y el total del combo (combo de 2)", () => {
    const m = mapShopifyOrder(
      baseOrder({
        total_price: "39990.00",
        line_items: [{ sku: "SKU-P90", quantity: 2, price: "19995.00" }],
      }),
    );
    expect(m.quantity).toBe(2);
    expect(m.totalPriceLocal).toBe(39990);
  });

  it("compone customerAddress legacy (calle + número)", () => {
    expect(mapShopifyOrder(baseOrder()).customerAddress).toBe(
      "Ramón Cruz Montt 2137",
    );
  });

  it("cae a los note_attributes si falta el shipping_address", () => {
    const m = mapShopifyOrder(baseOrder({ shipping_address: null, billing_address: null }));
    expect(m.customerName).toBe("Prueba Test");
    expect(m.customerStreet).toBe("Ramón Cruz Montt");
    expect(m.customerProvinceId).toBe(9); // via label "Formosa"
  });

  it("provincia no resoluble → customerProvinceId null (no rompe la ingesta)", () => {
    const m = mapShopifyOrder(
      baseOrder({
        shipping_address: { province: "Rarolandia", province_code: null },
        note_attributes: [
          { name: "Nombre completo", value: "Prueba Test" },
          { name: "Teléfono con Whatsapp", value: "5493814572504" },
          { name: "Provincia", value: "Rarolandia" },
        ],
      }),
    );
    expect(m.customerProvinceId).toBeNull();
  });

  it("strippea el país por defecto a Argentina si no viene", () => {
    const m = mapShopifyOrder(
      baseOrder({ shipping_address: { province_code: "P", country: null } }),
    );
    expect(m.customerCountry).toBe("Argentina");
  });

  it("lanza PayloadMappingError si falta nombre", () => {
    expect(() =>
      mapShopifyOrder(
        baseOrder({ shipping_address: null, billing_address: null, note_attributes: [
          { name: "Teléfono con Whatsapp", value: "5493814572504" },
        ] }),
      ),
    ).toThrow(PayloadMappingError);
  });

  it("lanza PayloadMappingError si falta teléfono", () => {
    expect(() =>
      mapShopifyOrder(
        baseOrder({ phone: null, shipping_address: { name: "X", province_code: "P" }, note_attributes: [
          { name: "Nombre completo", value: "Prueba Test" },
        ] }),
      ),
    ).toThrow(PayloadMappingError);
  });
});
