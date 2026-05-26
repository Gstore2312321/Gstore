const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  throw new Error(message);
};

const packageJson = JSON.parse(read("package.json"));
const railwayJson = JSON.parse(read("railway.json"));
const envExample = read(".env.example");
const gitignore = read(".gitignore");
const railwayIgnore = read(".railwayignore");
const server = read("server.js");

if (packageJson.scripts?.start !== "node server.js") fail("package.json necesita start=node server.js");
if (!packageJson.scripts?.check) fail("package.json necesita script check");
if (!packageJson.engines?.node) fail("package.json necesita engines.node para Railway");

if (railwayJson.build?.builder !== "RAILPACK") fail("railway.json debe usar build.builder=RAILPACK");
if (railwayJson.deploy?.startCommand !== "npm start") fail("railway.json debe usar npm start");
if (railwayJson.deploy?.healthcheckPath !== "/api/health") fail("railway.json debe apuntar healthcheck a /api/health");

[
  "NODE_ENV",
  "PUBLIC_BASE_URL",
  "ALLOWED_ORIGINS",
  "MYSQL_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_SECRET",
  "WHATSAPP_ADMIN_PHONE",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RESEND_API_KEY"
].forEach((key) => {
  if (!envExample.includes(`${key}=`)) fail(`.env.example no documenta ${key}`);
});

[
  "node_modules/",
  ".env",
  "reports-*.png",
  "backups/",
  "public/uploads/*"
].forEach((pattern) => {
  if (!gitignore.includes(pattern)) fail(`.gitignore no excluye ${pattern}`);
  if (!railwayIgnore.includes(pattern)) fail(`.railwayignore no excluye ${pattern}`);
});

if (!server.includes("IS_RAILWAY")) fail("server.js debe detectar Railway");
if (!server.includes("IS_PRODUCTION = process.env.NODE_ENV === \"production\" || IS_VERCEL || IS_RAILWAY")) {
  fail("server.js debe tratar Railway como produccion");
}
if (!exists("public/uploads/.gitkeep")) fail("public/uploads/.gitkeep debe existir");

console.log(JSON.stringify({
  ok: true,
  builder: railwayJson.build.builder,
  start: railwayJson.deploy.startCommand,
  healthcheck: railwayJson.deploy.healthcheckPath,
  node: packageJson.engines.node
}, null, 2));
