#!/usr/bin/env python3
"""Valida o modelo de dados do Instituto Lírios.

O alvo é MySQL 8, mas este ambiente não tem servidor MySQL. Para não entregar
um SQL não testado, o script:

  1. traduz o schema/seed/consultas (MySQL) para SQLite;
  2. executa tudo em memória e confere os dados carregados;
  3. roda cada consulta de db/consultas.sql com os parâmetros documentados;
  4. confere a integridade referencial (chaves estrangeiras) e as restrições.

Uso:  python3 db/validar.py
"""
import ast
import pathlib
import re
import sqlite3
import sys

BASE = pathlib.Path(__file__).resolve().parent
falhas = []


def ok(cond, msg, extra=''):
    if cond:
        print('  ok   ' + msg)
    else:
        falhas.append(msg)
        print('  FALHA ' + msg + (('  -> ' + str(extra)) if extra else ''))


# ---------------------------------------------------------------------------
# Tradução MySQL -> SQLite (só o subconjunto usado no projeto)
# ---------------------------------------------------------------------------

def traduzir_ddl(sql):
    s = sql
    s = re.sub(r'CREATE DATABASE[^;]*;', '', s, flags=re.I)
    s = re.sub(r'^\s*USE\s+\w+\s*;', '', s, flags=re.I | re.M)
    s = re.sub(r'SET\s+(NAMES\s+\w+|FOREIGN_KEY_CHECKS\s*=\s*\d+)\s*;', '', s, flags=re.I)
    s = re.sub(r'\s*\)\s*ENGINE=\w+[^;]*;', ');', s, flags=re.I)
    s = re.sub(r"\s+COMMENT\s+'[^']*'", '', s)
    s = re.sub(r'\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP', '', s, flags=re.I)
    s = re.sub(r'\b(INT|BIGINT|SMALLINT|TINYINT)(\s+UNSIGNED)?(\(\d+\))?', 'INTEGER', s, flags=re.I)
    s = re.sub(r'\bVARCHAR\(\d+\)', 'TEXT', s, flags=re.I)
    s = re.sub(r'\bCHAR\(\d+\)', 'TEXT', s, flags=re.I)
    s = re.sub(r'\bDECIMAL\(\d+,\s*\d+\)', 'NUMERIC', s, flags=re.I)
    s = re.sub(r'\bENUM\([^)]*\)', 'TEXT', s, flags=re.I)
    s = re.sub(r'\b(DATETIME|TIMESTAMP|DATE)\b', 'TEXT', s, flags=re.I)
    s = s.replace('AUTO_INCREMENT', '')
    return s


def traduzir_dml(sql):
    s = sql
    s = re.sub(r'^\s*USE\s+\w+\s*;', '', s, flags=re.I | re.M)
    s = re.sub(r'SET\s+(NAMES\s+\w+|FOREIGN_KEY_CHECKS\s*=\s*\d+)\s*;', '', s, flags=re.I)
    s = re.sub(
        r"TIMESTAMP\(\s*DATE_ADD\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\s*\),\s*'([\d:]+)'\s*\)",
        lambda m: "(date('now','+%s day') || ' %s')" % (m.group(1), m.group(2)),
        s, flags=re.I)
    s = re.sub(r'DATE_SUB\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\)', r"date('now','-\1 day')", s, flags=re.I)
    s = re.sub(r'DATE_ADD\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\)', r"date('now','+\1 day')", s, flags=re.I)
    s = re.sub(r'DATE_SUB\(NOW\(\),\s*INTERVAL\s+(\d+)\s+DAY\)', r"datetime('now','-\1 day')", s, flags=re.I)
    s = re.sub(r'DATEDIFF\(\s*([^(),]+)\s*,\s*CURDATE\(\)\s*\)',
               r"CAST(julianday(\1) - julianday('now','start of day') AS INTEGER)", s, flags=re.I)
    s = re.sub(r'CURDATE\(\)', "date('now')", s, flags=re.I)
    s = re.sub(r'NOW\(\)', "datetime('now')", s, flags=re.I)
    return s


def fatiar(script):
    """Divide um script em (comentário de params, sql) por ';'."""
    blocos, params, buffer = [], [], []
    for linha in script.splitlines():
        m = re.match(r'--\s*params:\s*(.*)$', linha)
        if m:
            params = m.group(1).strip()
        if linha.strip().startswith('--') or not linha.strip():
            continue
        buffer.append(linha)
        if linha.rstrip().endswith(';'):
            sql = '\n'.join(buffer).strip().rstrip(';').strip()
            if sql and not re.match(r'(?i)^\s*(USE|SET)\b', sql):
                blocos.append((params, sql))
            buffer, params = [], []
    return blocos


def ler_params(texto):
    if not texto or texto.lower().startswith('(nenhum'):
        return []
    return [ast.literal_eval(t.strip()) for t in texto.split(',')]


# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------

print('=' * 66)
print('VALIDAÇÃO DO MODELO — Instituto Lírios')
print('=' * 66)

schema = traduzir_ddl((BASE / 'schema.sql').read_text(encoding='utf-8'))
seed = traduzir_dml((BASE / 'seed.sql').read_text(encoding='utf-8'))

# sobra de sintaxe MySQL que o tradutor não cobriu?
for proibido in ['AUTO_INCREMENT', 'ENGINE=', 'utf8mb4', 'ENUM(', 'VARCHAR(']:
    if proibido in schema:
        falhas.append('tradução incompleta: ' + proibido)

db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys = ON')

print('\n[1] Estrutura')
db.executescript(schema)

tabelas = [r[0] for r in db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
views = [r[0] for r in db.execute(
    "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")]

ok(len(tabelas) == 9, '9 tabelas criadas', tabelas)
ok(len(views) == 3, '3 views criadas', views)
for t in ['usuarios', 'servicos', 'clientes', 'gestacoes', 'atendimentos',
          'atendimento_exames', 'contratos', 'agendamentos', 'pendencias']:
    ok(t in tabelas, 'tabela %s existe' % t)

indices = [r[0] for r in db.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")]
ok(len(indices) >= 14, 'índices de apoio criados (%d)' % len(indices), indices)

print('\n[2] Dados iniciais')
db.executescript(seed)

esperado = {
    'usuarios': 1, 'servicos': 5, 'clientes': 7, 'gestacoes': 1,
    'atendimentos': 3, 'atendimento_exames': 2, 'contratos': 5,
    'agendamentos': 4, 'pendencias': 4,
}
for tabela, quantidade in esperado.items():
    total = db.execute('SELECT COUNT(*) FROM ' + tabela).fetchone()[0]
    ok(total == quantidade, '%s: %d registro(s)' % (tabela, quantidade), total)

print('\n[3] Integridade referencial')
orfaos = db.execute("""
    SELECT COUNT(*) FROM contratos ct
    LEFT JOIN clientes c ON c.id = ct.cliente_id
    LEFT JOIN servicos s ON s.id = ct.servico_id
    WHERE c.id IS NULL OR s.id IS NULL""").fetchone()[0]
ok(orfaos == 0, 'nenhum contrato órfão', orfaos)

orfaos = db.execute("""
    SELECT COUNT(*) FROM atendimentos a
    LEFT JOIN clientes c ON c.id = a.cliente_id
    WHERE c.id IS NULL""").fetchone()[0]
ok(orfaos == 0, 'nenhum atendimento órfão', orfaos)

# regra de negócio: contrato assinado tem data de assinatura
ruins = db.execute(
    "SELECT COUNT(*) FROM contratos WHERE status = 'assinado' AND assinado_em IS NULL").fetchone()[0]
ok(ruins == 0, 'todo contrato assinado tem assinado_em', ruins)

# regra: só uma gestação em acompanhamento por cliente
duplicadas = db.execute("""
    SELECT cliente_id, COUNT(*) FROM gestacoes
    WHERE encerrada_em IS NULL GROUP BY cliente_id HAVING COUNT(*) > 1""").fetchall()
ok(len(duplicadas) == 0, 'no máximo uma gestação aberta por cliente', duplicadas)

# dpp coerente com a dum (280 dias)
for cliente, dum, dpp in db.execute('SELECT cliente_id, dum, dpp FROM gestacoes'):
    delta = (sqlite3.connect(':memory:').execute(
        "SELECT CAST(julianday(?) - julianday(?) AS INTEGER)", (dpp, dum)).fetchone()[0])
    ok(delta == 280, 'DPP = DUM + 280 dias (cliente %s)' % cliente, delta)

# ENUM só existe no MySQL; conferimos na fonte, não no espelho.
ddl = (BASE / 'schema.sql').read_text(encoding='utf-8')
ok("status               ENUM('ativa','pendente','inativa')" in ddl,
   "ENUM de status das clientes declarado no schema MySQL")
ok("status        ENUM('pendente','assinado','cancelado')" in ddl,
   "ENUM de status dos contratos declarado no schema MySQL")

print('\n[4] Restrições (devem falhar)')
tentativas = [
    ("INSERT INTO gestacoes (cliente_id, dum, dpp) VALUES (999, '2026-01-10', '2026-03-01')",
     'gestação de cliente inexistente é rejeitada'),
    ("INSERT INTO gestacoes (cliente_id, dum, dpp) VALUES (1, '2026-01-10', '2026-01-01')",
     'DPP anterior à DUM é rejeitada'),
    ("INSERT INTO contratos (cliente_id, servico_id, status, valor, assinado_em) "
     "VALUES (2, 2, 'assinado', 10, NULL)",
     'contrato assinado sem data é rejeitado'),
    ("INSERT INTO atendimentos (cliente_id, data_atendimento, bpm) VALUES (1, '2026-01-01', 999)",
     'batimento fora da faixa é rejeitado'),
    ("INSERT INTO contratos (cliente_id, servico_id) VALUES (1, 1)",
     'contrato duplicado (mesma cliente/serviço) é rejeitado'),
]
for sql, descricao in tentativas:
    try:
        db.execute(sql)
        db.rollback()
        ok(False, descricao, 'a restrição NÃO foi aplicada')
    except sqlite3.Error:
        ok(True, descricao)

print('\n[5] Consultas da aplicação')
consultas = fatiar((BASE / 'consultas.sql').read_text(encoding='utf-8'))
ok(len(consultas) == 14, '14 consultas documentadas', len(consultas))

for i, (params_texto, sql) in enumerate(consultas, start=1):
    try:
        valores = ler_params(params_texto)
        if sql.count('?') != len(valores) and valores:
            valores = valores * sql.count('?')
        linhas = db.execute(traduzir_dml(sql), valores).fetchall()
        ok(True, 'consulta %02d executa (%d linha(s))' % (i, len(linhas)))
    except Exception as erro:  # noqa: BLE001
        ok(False, 'consulta %02d executa' % i, '%s | %s' % (erro, sql.splitlines()[0][:60]))

print('\n[6] Resultados esperados')
linha = db.execute("SELECT * FROM vw_resumo_cliente WHERE nome = 'Maria Silva'").fetchone()
colunas = [d[0] for d in db.execute("SELECT * FROM vw_resumo_cliente WHERE nome = 'Maria Silva'").description]
dados = dict(zip(colunas, linha))
ok(dados['total_atendimentos'] == 3, 'Maria tem 3 atendimentos', dados['total_atendimentos'])
ok(dados['parto_previsto'] is not None, 'Maria tem parto previsto', dados['parto_previsto'])
ok(dados['servico_principal'] == 'Pré-natal', 'serviço principal da Maria', dados['servico_principal'])

totais = db.execute("""
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'assinado' THEN 1 ELSE 0 END) AS assinados,
           SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes
    FROM contratos""").fetchone()
ok(totais == (5, 3, 2), 'contratos: 5 total / 3 assinados / 2 pendentes', totais)

proximos = db.execute("SELECT COUNT(*) FROM vw_gestacao_atual WHERE dpp >= date('now')").fetchone()[0]
ok(proximos == 1, 'uma gestação com parto futuro', proximos)

print('\n' + '=' * 66)
if falhas:
    print('%d VERIFICAÇÃO(ÕES) FALHARAM:' % len(falhas))
    for f in falhas:
        print(' -', f)
    sys.exit(1)

print('MODELO VALIDADO: estrutura, dados, restrições e consultas OK')
