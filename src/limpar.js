/* Regras de limpeza (usada pelo build e pela tela de Administração). Retorna a lista de apartamentos válidos. */
function limpar(brutos, semDoces){
  const vazio = v => v === null || v === undefined || String(v).trim() === '';
  const validos = [];
  brutos.forEach(r=>{
    const [ts,,aptoRaw,blocoRaw,qtdRaw] = r;
    if(vazio(aptoRaw)||vazio(blocoRaw)) return;                 // apto ou bloco em branco: descarta
    const m = String(aptoRaw).match(/\d+/);                     // normaliza: só o número do apartamento
    const qtd = vazio(qtdRaw) ? 0 : Number(qtdRaw);             // crianças em branco = 0 (participa)
    if(!m || isNaN(qtd)) return;                                // apartamento inválido (sem número): descarta
    validos.push({apto:parseInt(m[0],10), torre:String(blocoRaw).trim().toUpperCase(), criancas:qtd, quando:new Date(ts)});
  });
  const mapa = new Map();                                       // duplicado (apto+torre): vale a resposta mais recente
  validos.sort((a,b)=>a.quando-b.quando).forEach(r=>mapa.set(r.torre+'|'+r.apto,r));
  const dados = [...mapa.values()].sort((a,b)=>a.torre.localeCompare(b.torre)||a.apto-b.apto);
  dados.forEach(d=>d.entrega = !semDoces.includes(d.torre+d.apto));
  return dados;
}
