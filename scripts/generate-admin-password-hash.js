const bcrypt = require("bcryptjs");

const password = process.argv.slice(2).join(" ") || process.env.ADMIN_PASSWORD || "";

if (!password || password.length < 12) {
  console.error("Uso: npm run hash:admin -- \"clave-larga-de-12-caracteres-minimo\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
