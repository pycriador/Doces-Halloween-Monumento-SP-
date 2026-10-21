"""Converte o Excel do formulário em rows.json (NÃO versionar esse arquivo: contém os dados brutos).
Uso: python3 tools/xlsx_para_json.py planilha.xlsx rows.json"""
import sys, json, pandas as pd
df = pd.read_excel(sys.argv[1])
c = lambda v: None if pd.isna(v) else (v.item() if hasattr(v, 'item') else v)
rows = []
for r in df.itertuples(index=False):
    q, a = c(r[4]), c(r[2])
    q = int(q) if q is not None else None
    a = int(a) if isinstance(a, float) else a
    rows.append([pd.Timestamp(r[0]).strftime('%Y-%m-%dT%H:%M:%S'), c(r[1]), a, c(r[3]), q])
json.dump(rows, open(sys.argv[2], 'w'), ensure_ascii=False)
print(len(rows), 'linhas')
