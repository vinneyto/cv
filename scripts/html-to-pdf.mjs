#!/usr/bin/env node
import { readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, extname, basename } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// HTML files in the project root that should NOT be converted to PDF
// (e.g. landing/navigation pages).
const EXCLUDE = new Set(["index.html"]);

async function findHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        extname(entry.name).toLowerCase() === ".html" &&
        !EXCLUDE.has(entry.name)
    )
    .map((entry) => join(dir, entry.name));
}

async function convert(browser, htmlPath, outDir) {
  const name = basename(htmlPath, extname(htmlPath));
  const outPath = join(outDir, `${name}.pdf`);

  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: ["load", "networkidle0"],
    });
    await page.emulateMediaType("screen");
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
  } finally {
    await page.close();
  }

  return outPath;
}

async function main() {
  const outDir = projectRoot;
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  const files = await findHtmlFiles(projectRoot);
  if (files.length === 0) {
    console.log("No HTML files found.");
    return;
  }

  console.log(`Converting ${files.length} HTML file(s) to PDF...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const file of files) {
      const out = await convert(browser, file, outDir);
      console.log(`  ${basename(file)} -> ${basename(out)}`);
    }
  } finally {
    await browser.close();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
