// Builds WebP copies of the large static images in public/assets, served
// automatically to browsers that accept WebP (middleware.js). The original
// files, their URLs and the CMS data are untouched; browsers without WebP
// keep getting the originals.
//
// Quality 86 at the original resolution (capped at 2560 px wide): visually
// indistinguishable on these photos, a fraction of the PNG size.
//
//   node scripts/optimizeImages.mjs     (re-run after replacing an asset)
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const SRC = path.join(process.cwd(), "public", "assets")
const OUT = path.join(SRC, "_webp")
const MIN_BYTES = 100 * 1024 // not worth it below this

await fs.mkdir(OUT, { recursive: true })
const manifest = []
let before = 0
let after = 0

for (const name of await fs.readdir(SRC)) {
  if (!/\.(png|jpe?g)$/i.test(name)) continue
  const file = path.join(SRC, name)
  const { size } = await fs.stat(file)
  if (size < MIN_BYTES) continue
  const target = path.join(OUT, `${name}.webp`)
  const meta = await sharp(file).metadata()
  await sharp(file)
    .resize({ width: Math.min(meta.width || 2560, 2560), withoutEnlargement: true })
    .webp({ quality: 86, effort: 5 })
    .toFile(target)
  const out = (await fs.stat(target)).size
  // Only use the copy when it's genuinely smaller.
  if (out < size * 0.9) {
    manifest.push(name)
    before += size
    after += out
    console.log(`${name.padEnd(42)} ${(size / 1024).toFixed(0).padStart(6)} KB → ${(out / 1024).toFixed(0).padStart(5)} KB`)
  } else {
    await fs.unlink(target)
  }
}

await fs.writeFile(path.join(process.cwd(), "lib", "optimizedAssets.json"), `${JSON.stringify(manifest.sort(), null, 2)}\n`)
console.log(`\n${manifest.length} images: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`)
