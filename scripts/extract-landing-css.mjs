import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tsx = fs.readFileSync(path.join(root, "app/components/LandingPage.tsx"), "utf8");
const m = tsx.match(/<style jsx>\{`([\s\S]*?)`\}<\/style>/);
if (!m) throw new Error("no style block");

let css = m[1].replace(/^        /gm, "");
css = css.replace(/^\.lp \{/m, "main.lp {");
css = css.replace(/\/\* ghost cards: see landing-ghost-cards\.css[\s\S]*?\*\/\s*/g, "");

const lines = css.split("\n");
const out = [];
for (const line of lines) {
  const t = line.trim();
  if (t.startsWith("@keyframes") || t.startsWith("@media")) {
    out.push(line);
    continue;
  }
  if (t.startsWith("main.lp")) {
    out.push(line);
    continue;
  }
  if (t.startsWith(".") && !t.startsWith("main.lp")) {
    const indent = line.match(/^\s*/)[0];
    out.push(indent + "main.lp " + t);
    continue;
  }
  out.push(line);
}
css = out.join("\n");

fs.writeFileSync(path.join(root, "app/landing-page.css"), css);
console.log("Wrote app/landing-page.css", css.length);
