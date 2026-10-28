#!/usr/bin/env node
/* Baixa a planilha (Google Sheets publicado como CSV) e gera rows.json no mesmo formato de xlsx_para_json.py.
   Uso: node tools/sync_planilha.mjs <url-csv> rows.json
   A URL não deve ser versionada (fica num secret do GitHub Actions: SHEET_CSV_URL). */
import fs from 'node:fs';

const [url, destino] = process.argv.slice(2);
if (!url || !destino) { console.error('Uso: node tools/sync_planilha.mjs <url-csv> <rows.json>'); process.exit(1); }

function parseCSV(texto) {
  const linhas = [];
  let campo = '', linha = [], dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i], prox = texto[i + 1];
    if (dentroAspas) {
      if (c === '"' && prox === '"') { campo += '"'; i++; }
      else if (c === '"') dentroAspas = false;
      else campo += c;
    } else if (c === '"') dentroAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\r') { /* ignora: \r\n tratado pelo \n */ }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.length > 1 || l[0] !== '');
}

const isoDaData = s => {                                        // "15/10/2026 15:27:28" (pt-BR) -> ISO
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}` : String(s).trim();
};

const resp = await fetch(url);
if (!resp.ok) { console.error('Falha ao baixar o CSV:', resp.status, resp.statusText); process.exit(1); }
const csv = await resp.text();
const linhas = parseCSV(csv).slice(1);                            // descarta o cabeçalho
const rows = linhas
  .filter(l => l.some(v => String(v ?? '').trim() !== ''))
  .map(l => [isoDaData(l[0]), (l[1] ?? '').trim(), (l[2] ?? '').trim(), (l[3] ?? '').trim(), (l[4] ?? '').trim()]);

fs.writeFileSync(destino, JSON.stringify(rows));
console.log(`${rows.length} linhas salvas em ${destino}`);
