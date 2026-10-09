// Seeds lookup data every pharmacy needs. The admin account is created in /setup, not here.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const withSamples = process.argv.includes("--samples") || process.env.SEED_SAMPLES === "1";

async function main() {
  await db.storeSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const categories = ["Analgesic", "Antibiotic", "Antacid", "Antihistamine", "Antidiabetic", "Cardiac", "Vitamins & Supplements", "Cough & Cold", "Skin Care", "Surgical", "Baby Care", "General"];
  for (const name of categories) await db.category.upsert({ where: { name }, create: { name }, update: {} });

  const manufacturers = ["GSK", "Abbott", "Getz Pharma", "Searle", "Sami Pharma", "Hilton Pharma", "Martin Dow", "Ferozsons", "Pfizer", "Local"];
  for (const name of manufacturers) await db.manufacturer.upsert({ where: { name }, create: { name }, update: {} });

  console.log("Categories and companies added. Open the app to run first-time setup (/setup).");
  if (!withSamples) return;

  // Sample stock movements need a user — the admin created in /setup.
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.log("Skipping sample medicines: finish /setup in the browser first, then run this again.");
    return;
  }

  const cat = async (n: string) => (await db.category.findUniqueOrThrow({ where: { name: n } })).id;
  const man = async (n: string) => (await db.manufacturer.findUniqueOrThrow({ where: { name: n } })).id;

  const supplier = (await db.supplier.findFirst({ where: { name: "Sample Distributors" } })) ??
    (await db.supplier.create({ data: { name: "Sample Distributors", phone: "0300-0000000", contactPerson: "Ali" } }));
  if (!(await db.customer.findFirst({ where: { name: "Walk-in Regular" } }))) {
    await db.customer.create({ data: { name: "Walk-in Regular", phone: "0311-1111111" } });
  }
  void supplier;

  const samples = [
    { name: "Panadol", genericName: "Paracetamol", strength: "500mg", form: "Tablet", c: "Analgesic", m: "GSK", unitName: "Tablet", packName: "Strip", unitsPerPack: 10, price: 30, cost: 24, barcode: "8964000000011" },
    { name: "Brufen", genericName: "Ibuprofen", strength: "400mg", form: "Tablet", c: "Analgesic", m: "Abbott", unitName: "Tablet", packName: "Strip", unitsPerPack: 10, price: 65, cost: 52, barcode: "8964000000028" },
    { name: "Augmentin", genericName: "Amoxicillin + Clavulanic Acid", strength: "625mg", form: "Tablet", c: "Antibiotic", m: "GSK", unitName: "Tablet", packName: "Strip", unitsPerPack: 6, price: 420, cost: 350, rx: true, barcode: "8964000000035" },
    { name: "Risek", genericName: "Omeprazole", strength: "20mg", form: "Capsule", c: "Antacid", m: "Getz Pharma", unitName: "Capsule", packName: "Strip", unitsPerPack: 7, price: 190, cost: 155, barcode: "8964000000042" },
    { name: "Softin", genericName: "Loratadine", strength: "10mg", form: "Tablet", c: "Antihistamine", m: "Hilton Pharma", unitName: "Tablet", packName: "Strip", unitsPerPack: 10, price: 150, cost: 120 },
    { name: "Hydryllin Syrup", genericName: "Diphenhydramine + Ammonium Chloride", strength: "120ml", form: "Syrup", c: "Cough & Cold", m: "Searle", unitName: "Bottle", packName: "Bottle", unitsPerPack: 1, price: 140, cost: 112 },
    { name: "Glucophage", genericName: "Metformin", strength: "500mg", form: "Tablet", c: "Antidiabetic", m: "Martin Dow", unitName: "Tablet", packName: "Strip", unitsPerPack: 10, price: 70, cost: 56 },
    { name: "CaC-1000 Plus", genericName: "Calcium + Vitamin C", strength: "1000mg", form: "Effervescent", c: "Vitamins & Supplements", m: "GSK", unitName: "Tablet", packName: "Tube", unitsPerPack: 10, price: 390, cost: 320, loose: false },
  ];

  const year = new Date().getFullYear();
  for (const [i, s] of samples.entries()) {
    const existing = await db.medicine.findFirst({ where: { name: s.name } });
    if (existing) continue;
    const med = await db.medicine.create({
      data: {
        name: s.name, genericName: s.genericName, strength: s.strength, form: s.form,
        categoryId: await cat(s.c), manufacturerId: await man(s.m),
        unitName: s.unitName, packName: s.packName, unitsPerPack: s.unitsPerPack, salePrice: s.price,
        reorderLevel: s.unitsPerPack * 5, requiresPrescription: !!s.rx, allowLooseSale: s.loose ?? true,
        barcode: s.barcode, rackLocation: `R${(i % 4) + 1}`,
      },
    });
    // Two batches: one expiring soon, one later — shows FEFO + expiry alerts.
    const batches = [
      { batchNo: `B${i}A`, expiry: new Date(Date.UTC(year, new Date().getMonth() + 2, 1)), packs: 3 },
      { batchNo: `B${i}B`, expiry: new Date(Date.UTC(year + 2, 5, 1)), packs: 20 },
    ];
    for (const b of batches) {
      const qty = b.packs * s.unitsPerPack;
      const batch = await db.batch.create({
        data: { medicineId: med.id, batchNo: b.batchNo, expiryDate: b.expiry, costPrice: s.cost, salePrice: s.price, quantity: qty },
      });
      await db.stockMovement.create({ data: { batchId: batch.id, medicineId: med.id, type: "OPENING", quantity: qty, note: "Sample opening stock", userId: admin.id } });
    }
  }
  console.log("Sample medicines added.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
