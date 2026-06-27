import bcrypt from "bcryptjs";

/** Genera el hash bcrypt de un password. Uso: npm run hash-password <password> */
const password = process.argv[2];
if (!password) {
  console.error("Uso: npm run hash-password <password>");
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 10));
