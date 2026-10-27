#!/usr/bin/env node
/* Gera o index.html (tela pública + área de Administração criptografada).
   node tools/build.mjs init                 -> cria keystore.json e imprime o SEGREDO (uma única vez)
   node tools/build.mjs build rows.json [participantes.atual.json] [index.atual.html]  -> com o 3º argumento, NÃO regenera a página pública: troca só o bloco criptografado da Administração do index.atual.html.
   (antigo:) node tools/build.mjs build rows.json [participantes.atual.json] -> gera index.html + participantes.json (mescla edições manuais; não precisa do segredo)
   SEGREDO=... node tools/build.mjs decrypt [index.html] > admin.html   -> descriptografa a Administração */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = (...p) => path.join(raiz, ...p), b64 = b => Buffer.from(b).toString('base64'), de64 = s => Buffer.from(s, 'base64');
const norm = s => String(s).replace(/\s+/g, '').toLowerCase();
const OAEP = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
const gcmEnc = (key, iv, buf) => { const c = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([c.update(buf), c.final(), c.getAuthTag()]); };
const gcmDec = (key, iv, buf) => { const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(buf.subarray(-16)); return Buffer.concat([d.update(buf.subarray(0, -16)), d.final()]); };
const [cmd, arg, arg2, arg3] = process.argv.slice(2);

if (cmd === 'init') {
  if (fs.existsSync(R('keystore.json'))) { console.error('keystore.json já existe (apague para gerar outro segredo).'); process.exit(1); }
  const alf = 'abcdefghjkmnpqrstuvwxyz23456789';                       // sem caracteres ambíguos
  const segredo = [0, 1, 2, 3].map(() => Array.from({ length: 6 }, () => alf[crypto.randomInt(alf.length)]).join('')).join('-');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), iter = 600000;
  const k = crypto.pbkdf2Sync(norm(segredo), salt, iter, 32, 'sha256');
  fs.writeFileSync(R('keystore.json'), JSON.stringify({ v: 1, kdf: { iter, salt: b64(salt) }, priv: { iv: b64(iv), ct: b64(gcmEnc(k, iv, privateKey)) }, pub: b64(publicKey) }, null, 1));
  console.log('SEGREDO:', segredo);
}

else if (cmd === 'build') {
  const ks = JSON.parse(fs.readFileSync(R('keystore.json'), 'utf8'));
  const rows = JSON.parse(fs.readFileSync(arg, 'utf8')).filter(r => !/^n/i.test(String(r[1] ?? '').trim())); // quem marcou "Não" no termo some por completo
  const regras = JSON.parse(fs.readFileSync(R('src/regras.json'), 'utf8'));
  const limparSrc = fs.readFileSync(R('src/limpar.js'), 'utf8');
  const dados = new Function(limparSrc + ';return limpar;')()(rows, regras.semDoces);
  /* "Atualizado em" = data/hora da PUBLICAÇÃO (fuso de São Paulo): muda a cada build */
  const fp = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()), pv = k => fp.find(x => x.type === k).value;
  const atualizado = `${pv('day')}/${pv('month')}/${pv('year')} ${pv('hour')}:${pv('minute')}`;
  /* lista pública: planilha + edições manuais do participantes.json atual (acabou, manuais, removidos) */
  const atual = arg2 && fs.existsSync(arg2) ? JSON.parse(fs.readFileSync(arg2, 'utf8')) : null, kk = (t, a) => t + '|' + a;
  const removidos = atual ? (atual.removidos || []) : regras.semDoces.map(s => { const m = s.match(/^([A-Z]+)(\d+)$/); return { torre: m[1], apto: +m[2] }; });
  const rem = new Set(removidos.map(r => kk(r.torre, r.apto))), velha = new Map((atual?.apartamentos || []).map(x => [kk(x.torre, x.apto), x]));
  const lista = dados.filter(d => !rem.has(kk(d.torre, d.apto))).map(d => ({ torre: d.torre, apto: d.apto, acabou: !!velha.get(kk(d.torre, d.apto))?.acabou, origem: 'planilha' }));
  (atual?.apartamentos || []).filter(x => x.origem === 'manual' && !lista.some(l => l.torre === x.torre && l.apto === x.apto)).forEach(x => lista.push({ torre: x.torre, apto: x.apto, acabou: !!x.acabou, origem: 'manual' }));
  lista.sort((a, b) => a.torre.localeCompare(b.torre) || a.apto - b.apto);
  const saida = { versao: 1, atualizado, editadoEm: null, apartamentos: lista, removidos };
  const um = o => ' ' + JSON.stringify(o);
  fs.writeFileSync(R('participantes.json'), `{"versao":1,"atualizado":${JSON.stringify(atualizado)},"editadoEm":null,\n"apartamentos":[\n${lista.map(um).join(',\n')}\n],\n"removidos":[\n${removidos.map(r => um({ torre: r.torre, apto: r.apto })).join(',\n')}\n]}\n`);
  const admin = fs.readFileSync(R('src/admin.template.html'), 'utf8')
    .replace('/*__LIMPAR__*/', () => limparSrc).replace('__SEM_DOCES__', () => JSON.stringify(regras.semDoces)).replace('__LISTA__', () => JSON.stringify(saida))
    .replace('__DADOS__', () => '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]');
  const dek = crypto.randomBytes(32), iv = crypto.randomBytes(12);        // chave de dados aleatória, protegida pela chave pública RSA
  const w = crypto.publicEncrypt({ key: crypto.createPublicKey({ key: de64(ks.pub), format: 'der', type: 'spki' }), ...OAEP }, dek);
  const pl = { w: b64(w), iv: b64(iv), ct: b64(gcmEnc(dek, iv, Buffer.from(admin, 'utf8'))) };
  const pub = JSON.stringify(saida);
  if (arg3) {   /* modo seguro: preserva a página pública do GitHub e troca só a Administração criptografada */
    const base = fs.readFileSync(arg3, 'utf8'), re = /(<script type="application\/json" id="pl">).*?(<\/script>)/s;
    if (!re.test(base)) throw new Error('index atual sem bloco id="pl"');
    fs.writeFileSync(R('index.html'), base.replace(re, (m, a, b) => a + JSON.stringify(pl) + b));
  } else fs.writeFileSync(R('index.html'), fs.readFileSync(R('src/public.template.html'), 'utf8')
    .replace('__PUBLICO__', () => pub).replace('__KS__', () => JSON.stringify(ks)).replace('__PL__', () => JSON.stringify(pl)));
  console.log(`index.html gerado: ${dados.length} apartamentos, ${lista.length} na lista pública, ${dados.reduce((s, d) => s + d.criancas, 0)} crianças`);
}

else if (cmd === 'decrypt') {
  const ks = JSON.parse(fs.readFileSync(R('keystore.json'), 'utf8')), html = fs.readFileSync(arg || R('index.html'), 'utf8');
  const pl = JSON.parse(html.match(/<script type="application\/json" id="pl">(.*?)<\/script>/s)[1]);
  const k = crypto.pbkdf2Sync(norm(process.env.SEGREDO || ''), de64(ks.kdf.salt), ks.kdf.iter, 32, 'sha256');
  const priv = gcmDec(k, de64(ks.priv.iv), de64(ks.priv.ct));
  const dek = crypto.privateDecrypt({ key: crypto.createPrivateKey({ key: priv, format: 'der', type: 'pkcs8' }), ...OAEP }, de64(pl.w));
  process.stdout.write(gcmDec(dek, de64(pl.iv), de64(pl.ct)));
} else console.error('Comandos: init | build rows.json | decrypt [index.html]');
