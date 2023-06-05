import { MainApp } from "../app/MainApp";
import { getAllFormats } from "./Format";

function exportPathFile(app: MainApp): string | undefined {
  try {
    return app.format.exportPathFile(app);
  } catch (err) {
    console.log(err);
    alert("Error: Cannot export path file"); // TODO better error handling

    return undefined;
  }
}

async function writeFile(app: MainApp, contents: string): Promise<boolean> {
  try {
    const fileHandle = app.mountingFile;
    if (fileHandle === null) throw new Error("fileHandle is undefined");

    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();

    // TODO Show save notification
    return true;
  } catch (err) {
    console.log(err);

    alert("Error: Cannot save path file"); // TODO better error handling
    return false;
  }
}

async function readFile(app: MainApp): Promise<string | undefined> {
  const options = {
    types: [{ description: 'Path Files', accept: { 'text/plain': [] } },],
  };

  try {
    const [fileHandle] = await window.showOpenFilePicker(options);
    app.mountingFile = fileHandle;

    const file = await fileHandle.getFile();
    const contents = await file.text();

    return contents;
  } catch (err) {
    console.log(err);

    alert("Error: Cannot read path file"); // TODO better error handling
    return undefined;
  }
}

async function choiceSave(app: MainApp): Promise<boolean> {
  const options = {
    types: [{ description: 'Path Files', accept: { 'text/plain': [] } },],
  };

  try {
    const fileHandle = await window.showSaveFilePicker(options);
    app.mountingFile = fileHandle;
    return true;
  } catch (err) {
    console.log(err);

    // ignore error
    return false;
  }
}

export async function onNew(app: MainApp) {
  // TODO: check unsaved change?

  const newFormat = getAllFormats().find(format => format.getName() === app.format.getName());
  if (newFormat === undefined) return;

  newFormat.init();

  app.format = newFormat;
  app.gc = app.format.buildGeneralConfig();
  app.paths = [];
  app.usingUOL = app.gc.uol;
  app.selected = [];
  app.expanded = [];
}

export async function onSave(app: MainApp) {
  if (app.mountingFile === null) return onSaveAs(app);

  const output = exportPathFile(app);
  if (output === undefined) return;

  await writeFile(app, output);
}

export async function onSaveAs(app: MainApp) {
  const output = exportPathFile(app);
  if (output === undefined) return;

  if (!await choiceSave(app)) return;
  await writeFile(app, output);
}

export async function onOpen(app: MainApp) {
  let contents = await readFile(app);
  if (contents === undefined) return;

  try {
    app.importPathFile(contents);
  } catch (err) {
    console.log(err);

    alert("Error: Cannot import path file"); // TODO better error handling
  }
}

export function onDownload(app: MainApp) {
  const output = exportPathFile(app);
  if (output === undefined) return;

  const a = document.createElement("a");
  const file = new Blob([output], { type: "text/plain" });
  a.href = URL.createObjectURL(file);
  a.download = "path.jerryio.txt"; // TODO better file name
  a.click();
}