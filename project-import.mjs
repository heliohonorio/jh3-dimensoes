/**
 * Extrai estimativas reais de arquivos fatiados pelo Bambu Studio/Orca.
 * Os arquivos são processados neste navegador, sem envio a servidores.
 */
const FILE_LIMIT = 160 * 1024 * 1024;
const META_LIMIT = 3 * 1024 * 1024;
const decoder = new TextDecoder('utf-8');

const positive = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const attr = (tag, name) => {
  const match = tag.match(new RegExp('(?:\\s|^)' + name + '\\s*=\\s*"([^"]*)"', 'i'));
  return match?.[1] ?? '';
};

export function parseSliceInfo(xml) {
  const plates = [...xml.matchAll(/<plate\b[^>]*>([\s\S]*?)<\/plate\s*>/gi)];
  if (!plates.length) {
    throw new Error('Esse 3MF não traz o resultado do fatiamento. No Bambu Studio, exporte o arquivo da placa fatiada.');
  }
  let grams = 0, seconds = 0;
  const materials = new Set(), printers = new Set();
  for (const [, body] of plates) {
    const metadata = new Map();
    for (const tag of body.match(/<metadata\b[^>]*\/?>/gi) || []) {
      const key = attr(tag, 'key').toLowerCase();
      if (key) metadata.set(key, attr(tag, 'value'));
    }
    const prediction = positive(metadata.get('prediction'));
    const filaments = body.match(/<filament\b[^>]*\/?>/gi) || [];
    let filamentWeight = 0;
    for (const filament of filaments) {
      const n = positive(attr(filament, 'used_g'));
      if (n) filamentWeight += n;
      const material = attr(filament, 'type');
      if (material) materials.add(material.toUpperCase());
    }
    const weight = positive(metadata.get('weight')) ?? positive(filamentWeight);
    if (!prediction || !weight) {
      throw new Error('Uma das placas não possui tempo e gramas confiáveis. Fatie todas as placas antes de importar.');
    }
    grams += weight;
    seconds += prediction;
    const machine = metadata.get('printer_model_id');
    if (machine) printers.add(machine);
  }
  return {
    grams, seconds, plates: plates.length,
    material: [...materials].join(', '),
    printer: printers.size === 1 ? [...printers][0] : printers.size > 1 ? 'Várias impressoras' : ''
  };
}

function secondsFromText(text) {
  let seconds = 0, found = false;
  for (const [, number, unit] of String(text).matchAll(/(\d+(?:[.,]\d+)?)\s*(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi)) {
    const multiplier = unit.toLowerCase()[0] === 'd' ? 86400 :
      unit.toLowerCase()[0] === 'h' ? 3600 :
      unit.toLowerCase()[0] === 'm' ? 60 : 1;
    seconds += Number(number.replace(',', '.')) * multiplier;
    found = true;
  }
  return found && seconds > 0 ? seconds : null;
}

export function parseGcode(text) {
  const gramsText = text.match(/;\s*total\s+filament\s+weight\s*\[g\]\s*:\s*([\d.]+)/i)
    || text.match(/;\s*filament\s+used\s*\[g\]\s*=\s*([\d.]+)/i)
    || text.match(/;\s*filament\s+used\s*\(g\)\s*=\s*([\d.]+)/i);
  const estimated = text.match(/total\s+estimated\s+time\s*:\s*([^;\r\n]+)/i)
    || text.match(/;\s*estimated\s+printing\s+time\s*\([^)]*\)\s*=\s*([^;\r\n]+)/i)
    || text.match(/;\s*estimated\s+printing\s+time\s*:\s*([^;\r\n]+)/i);
  const grams = positive(gramsText?.[1]);
  const seconds = secondsFromText(estimated?.[1]);
  if (!grams || !seconds) {
    throw new Error('Esse G-code não informa peso e tempo de impressão. Exporte a placa fatiada do Bambu Studio.');
  }
  const printer = text.match(/^;\s*printer_model\s*=\s*([^\r\n]+)/im)?.[1]?.trim() ?? '';
  return { grams, seconds, plates: 1, material: '', printer };
}

async function unzipMetadata(file) {
  if (file.size > FILE_LIMIT) throw new Error('O arquivo excede 160 MB.');
  const data = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let p = data.length - 22; p >= Math.max(0, data.length - 65557); p--) {
    if (dv.getUint32(p, true) === 0x06054b50) { end = p; break; }
  }
  if (end < 0) throw new Error('Esse arquivo 3MF não contém a estrutura ZIP esperada.');
  const count = dv.getUint16(end + 10, true);
  let offset = dv.getUint32(end + 16, true);
  if (count > 20000) throw new Error('Esse 3MF possui entradas demais.');
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > data.length || dv.getUint32(offset, true) !== 0x02014b50) throw new Error('Arquivo 3MF danificado.');
    const flags = dv.getUint16(offset + 8, true);
    const method = dv.getUint16(offset + 10, true);
    const compressedSize = dv.getUint32(offset + 20, true);
    const size = dv.getUint32(offset + 24, true);
    const nameLength = dv.getUint16(offset + 28, true);
    const extraLength = dv.getUint16(offset + 30, true);
    const commentLength = dv.getUint16(offset + 32, true);
    const local = dv.getUint32(offset + 42, true);
    if (offset + 46 + nameLength > data.length) throw new Error('Índice 3MF danificado.');
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength)).replace(/\\/g, '/').toLowerCase();
    offset += 46 + nameLength + extraLength + commentLength;
    if (!['metadata/slice_info.config', 'metadata/project_settings.config'].includes(name)) continue;
    if ((flags & 1) || size > META_LIMIT || compressedSize > META_LIMIT || local + 30 > data.length || dv.getUint32(local, true) !== 0x04034b50) {
      throw new Error('Os metadados desse 3MF não podem ser lidos.');
    }
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    if (start + compressedSize > data.length) throw new Error('Arquivo 3MF incompleto.');
    const bytes = data.slice(start, start + compressedSize);
    let content;
    if (method === 0) {
      content = bytes;
    } else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Seu navegador não suporta a compactação desse 3MF.');
      const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      content = new Uint8Array(await new Response(decompressed).arrayBuffer());
    } else {
      throw new Error('Compactação do 3MF não reconhecida.');
    }
    if (content.length > META_LIMIT || content.length !== size) throw new Error('Metadados do 3MF inválidos.');
    entries.set(name, decoder.decode(content));
  }
  return entries;
}

function titleFromFilename(name) {
  return name.replace(/\.gcode\.3mf$|\.3mf$|\.gcode$|\.gco$|\.stl$|\.obj$/i, '')
    .replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Peça impressa em 3D';
}

export async function inspectProjectFile(file) {
  if (!file || !file.name) throw new Error('Selecione um arquivo de impressão.');
  if (file.size > FILE_LIMIT) throw new Error('O arquivo excede 160 MB.');
  const name = titleFromFilename(file.name);
  if (/\.(stl|obj)$/i.test(file.name)) {
    throw new Error('STL e OBJ não possuem tempo ou gramas. Fatie no Bambu Studio para A1 Mini e exporte um .gcode.3mf.');
  }
  if (/\.3mf$/i.test(file.name)) {
    const entries = await unzipMetadata(file);
    const xml = entries.get('metadata/slice_info.config');
    if (!xml) throw new Error('Este 3MF não está fatiado. No Bambu Studio, fatie e use "Export plate sliced file".');
    const info = parseSliceInfo(xml);
    let fallbackPrinter = '';
    try {
      const project = JSON.parse(entries.get('metadata/project_settings.config') || '{}');
      fallbackPrinter = typeof project.printer_model === 'string' ? project.printer_model : '';
    } catch {}
    return { ...info, printer: info.printer || fallbackPrinter, name, source: '3MF fatiado' };
  }
  if (/\.(gcode|gco)$/i.test(file.name)) {
    const text = await file.slice(0, Math.min(1024 * 1024, file.size)).text();
    return { ...parseGcode(text), name, source: 'G-code fatiado' };
  }
  throw new Error('Selecione um arquivo .gcode.3mf ou .gcode exportado do fatiador.');
}

export async function fetchSlicedFile(url) {
  const parsed = new URL(String(url).trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
    throw new Error('O endereço deve ser um link HTTPS público.');
  }
  if (!/\.(gcode\.3mf|3mf|gcode|gco)$/i.test(parsed.pathname)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(parsed.href, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error('Não foi possível baixar o projeto desse link.');
    if (Number(response.headers.get('content-length')) > FILE_LIMIT) throw new Error('Arquivo muito grande.');
    const blob = await response.blob();
    if (blob.size > FILE_LIMIT) throw new Error('Arquivo muito grande.');
    const filename = decodeURIComponent(parsed.pathname.split('/').pop());
    return inspectProjectFile(new File([blob], filename));
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O site demorou demais para liberar o arquivo.');
    if (error instanceof TypeError) throw new Error('O site bloqueou o download direto. Baixe o arquivo fatiado e selecione-o aqui.');
    throw error;
  } finally { clearTimeout(timer); }
}
