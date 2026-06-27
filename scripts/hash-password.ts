import bcrypt from "bcryptjs";

/** Genera el hash bcrypt de un password. Uso: npm run hash-password <password> */
const password = process.argv[2];
if (!password) {
  console.error("Uso: npm run hash-password <password>");
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 10);
console.log("bcrypt:", hash);
console.log("base64:", Buffer.from(hash, "utf8").toString("base64"));
console.log(
  "\nUsá el valor base64 en DASHBOARD_USER_PASSWORD_HASH si tu plataforma corrompe los '$'.",
);
