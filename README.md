# 🎃 Coleta de Doces – Halloween 2026 · Condomínio Monumento São Paulo

Painel da coleta de doces do condomínio, publicado com **GitHub Pages**:
<https://pycriador.github.io/Doces-Halloween-Monumento-SP-/>

## Telas

| Tela | Quem vê | O que mostra |
|---|---|---|
| **Pública** (`index.html`) | Todos | Botões por torre (A–F e "Todas"). Ao tocar, aparecem os apartamentos participantes da torre e a mensagem pronta para o WhatsApp (copiar ou abrir no WhatsApp). **Não mostra quantidade de crianças.** |
| **Administração** | Só quem tem a chave | Todos os dashboards: indicadores, crianças e apartamentos por torre, distribuição, respostas por dia, maiores grupos, tabela de participantes, lista para WhatsApp com opções e exportação/compartilhamento de PDF. |

Para entrar na Administração: toque em **🔒 Administração** no rodapé da tela pública e informe a chave.

## Regras de tratamento da planilha

1. Quem marcou **"Não"** no termo de aceite é excluído por completo (nem entra nos dados criptografados).
2. Linhas com **apartamento ou bloco em branco** são descartadas; apartamento sem número (ex.: texto livre) também.
3. O apartamento é **normalizado sem a letra do bloco** (`55B`, `162 B`, `F 53` → `55`, `162`, `53`).
4. **Quantidade de crianças em branco = 0** (o apartamento participa).
5. **Duplicados** (mesmo apartamento + torre): vale a resposta mais recente.
6. Apartamentos listados em `src/regras.json` (`semDoces`, formato `A231`) **não entregam doces**: contam as crianças, mas ficam fora das listas de apartamentos participantes.

## Como a Administração é protegida

Os dados e a tela de Administração ficam **criptografados dentro do `index.html`**; sem a chave só existe texto cifrado.

- A chave (24 caracteres aleatórios, ~119 bits) **não está em nenhum arquivo do repositório**.
- `PBKDF2-SHA256` (600 mil iterações) deriva uma chave a partir da chave de acesso → ela abre, com `AES-256-GCM`, a **chave privada RSA-3072** guardada em `keystore.json` (só a chave privada cifrada e a chave pública).
- Cada versão da Administração é cifrada com uma chave de dados aleatória (`AES-256-GCM`), protegida pela **chave pública RSA** (`RSA-OAEP`, SHA-256). Por isso **atualizar os dados não exige a chave de acesso**; **abrir** exige.
- A descriptografia acontece no navegador de quem entra. Chave errada = falha de autenticação, nada é exibido.

Limites: quem souber a chave vê tudo; a segurança depende de manter a chave em sigilo (guarde em um gerenciador de senhas). O código da tela (`src/`) é público, mas **sem dados**. Os dados brutos (`rows.json`) nunca devem ser versionados.

## Como descriptografar a área de Administração

**Pelo site:** abra a página pública → 🔒 Administração → informe a chave.

**Manualmente (Node 18+), gerando um arquivo local:**

```bash
git clone https://github.com/pycriador/Doces-Halloween-Monumento-SP-.git
cd Doces-Halloween-Monumento-SP-
SEGREDO='sua-chave-aqui' node tools/build.mjs decrypt > admin.html
# abra admin.html no navegador (contém dados: não envie para o repositório)
```

## Como atualizar os dados

```bash
pip install pandas openpyxl
python3 tools/xlsx_para_json.py planilha.xlsx /tmp/rows.json   # Excel -> JSON (fora do repositório)
node tools/build.mjs build /tmp/rows.json                       # gera index.html aplicando as regras
git add index.html && git commit -m "Atualiza dados" && git push
```

Basta enviar o novo Excel ao Claude: ele aplica as regras e publica (precisa de um token do GitHub do repositório).

## Estrutura

```
index.html                 # página publicada (pública + Administração criptografada)
keystore.json              # chave pública + chave privada CIFRADA (sem o segredo é inútil)
src/public.template.html   # modelo da tela pública e do login
src/admin.template.html    # modelo da Administração (sem dados)
src/limpar.js              # regras de limpeza
src/regras.json            # apartamentos que não entregam doces
tools/build.mjs            # init | build | decrypt
tools/xlsx_para_json.py    # Excel -> JSON
```

## Trocar a chave de acesso

Apague `keystore.json`, rode `node tools/build.mjs init` (imprime a nova chave uma única vez) e refaça o `build` com a planilha. A chave antiga deixa de abrir a versão nova.
