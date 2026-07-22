// Loader-хук: разрешает Vite-импорты вида "...pdf?url" / "...ttf?url" в node,
// подставляя абсолютный путь файла как строку (как делает Vite ?url). Вместе
// с shim'ом fetch в render-pdf.mjs это позволяет гонять реальный PDF-движок
// (blank2025.js / blankLegacy.js) офлайн для попиксельной сверки.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

export async function resolve(specifier, context, next) {
  if (specifier.endsWith("?url")) {
    const clean = specifier.slice(0, -4);
    const parent = fileURLToPath(context.parentURL);
    const abs = pathResolve(dirname(parent), clean);
    return { url: pathToFileURL(abs).href + "?url", shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith("?url")) {
    const filePath = fileURLToPath(url.slice(0, -4));
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(filePath)};`,
    };
  }
  return next(url, context);
}
