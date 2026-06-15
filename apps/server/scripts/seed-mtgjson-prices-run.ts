import seed from "./seed-mtgjson-prices";

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
