# API — Instituto Lírios

API REST em **Node.js + Express + MySQL** que expõe o banco criado em `../db/`.

```
server/
├── server.js        sobe o servidor HTTP
├── app.js           monta o Express (JSON, CORS, rotas, tratamento de erros)
├── db.js            pool de conexões e helper de transação
├── http.js          validação de entrada e erros HTTP
├── routes/          um arquivo por recurso
└── testes-api.js    testes das rotas (sem precisar de MySQL)
```

## Como rodar

```bash
# 1. banco (uma vez)
#    MySQL Workbench: execute db/schema.sql e depois db/seed.sql

# 2. dependências
cd server
npm install

# 3. configuração
cp .env.example .env      # ajuste usuário/senha do seu MySQL

# 4. subir
npm start                 # http://localhost:3000/api
```

Conferindo se o banco respondeu:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"banco":"conectado"}
```

> Se aparecer `{"ok":false,"banco":"indisponivel"}`, o MySQL não está ligado ou o
> `.env` está com usuário/senha errados.

## Endpoints

Todas as respostas são JSON. `:id` é sempre um inteiro.

### Autenticação
| Método | Rota | O que faz |
|---|---|---|
| POST | `/api/auth/login` | valida e-mail e senha (bcrypt) e devolve o usuário |

### Clientes
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/clientes?busca=&status=` | lista com filtro por nome/serviço e status |
| GET | `/api/clientes/:id` | ficha completa: dados + gestação atual + contratos + atendimentos |
| GET | `/api/clientes/:id/resumo` | linha da view de resumo (totais, último atendimento) |
| POST | `/api/clientes` | cadastra |
| PATCH/PUT | `/api/clientes/:id` | atualiza os campos enviados |
| DELETE | `/api/clientes/:id` | exclui (cascata em gestações, atendimentos, contratos…) |

### Gestações
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/gestacoes?cliente_id=` | histórico de gestações |
| GET | `/api/gestacoes/atual?cliente_id=` | gestação em acompanhamento |
| POST | `/api/gestacoes` | abre gestação (DPP calculada: DUM + 280 dias) |
| PUT | `/api/gestacoes/:id` | atualiza (recalcula a DPP se a DUM mudar) |
| PATCH | `/api/gestacoes/:id/encerrar` | encerra a gestação |
| DELETE | `/api/gestacoes/:id` | exclui |

### Atendimentos
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/atendimentos?cliente_id=&de=&ate=` | lista do período |
| GET | `/api/atendimentos/:id` | atendimento + exames |
| POST | `/api/atendimentos` | grava atendimento **e exames na mesma transação** |
| PUT | `/api/atendimentos/:id` | atualiza; se `exames` vier, substitui a lista |
| DELETE | `/api/atendimentos/:id` | exclui (cascata nos exames) |

### Contratos
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/contratos?status=&cliente_id=` | lista com cliente e serviço |
| GET | `/api/contratos/totais` | total / assinados / pendentes / cancelados |
| GET | `/api/contratos/:id` | um contrato |
| POST | `/api/contratos` | cria |
| PATCH | `/api/contratos/:id/assinar` | assina e grava `assinado_em` (idempotente) |
| PUT | `/api/contratos/:id` | altera status e valor |
| DELETE | `/api/contratos/:id` | exclui |

### Agenda
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/agenda?de=&ate=&cliente_id=&status=` | agendamentos do período |
| GET | `/api/agenda/hoje` | agenda do dia |
| POST | `/api/agenda` | agenda (usa a duração do serviço se não for informada) |
| PUT | `/api/agenda/:id` | reagenda / altera |
| PATCH | `/api/agenda/:id/status` | `agendado`, `concluido`, `cancelado`, `faltou` |
| DELETE | `/api/agenda/:id` | exclui |

### Pendências
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/pendencias?status=&cliente_id=` | lista |
| GET | `/api/pendencias/resumo` | abertas por tipo |
| POST | `/api/pendencias` | cria |
| PATCH | `/api/pendencias/:id/resolver` | marca como resolvida |
| DELETE | `/api/pendencias/:id` | exclui |

### Serviços e Dashboard
| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/servicos` | catálogo |
| POST | `/api/servicos` | cria |
| PUT | `/api/servicos/:id` | altera |
| DELETE | `/api/servicos/:id` | exclui (recusado se houver contrato/agendamento) |
| GET | `/api/dashboard` | indicadores + agenda de hoje + próximos partos + pendências |

## Exemplos

```bash
# cadastrar cliente
curl -X POST http://localhost:3000/api/clientes \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Lívia Prado","data_nascimento":"2000-02-29","telefone":"(99) 98888-0000","servico_principal_id":1}'

# registrar atendimento com exames
curl -X POST http://localhost:3000/api/atendimentos \
  -H 'Content-Type: application/json' \
  -d '{"cliente_id":1,"servico_id":1,"data_atendimento":"2026-10-28",
       "anotacoes":"Consulta tranquila.","bpm":145,"exames":["Hemograma completo"]}'

# agenda da semana
curl 'http://localhost:3000/api/agenda?de=2026-10-26&ate=2026-11-01'

# assinar contrato
curl -X PATCH http://localhost:3000/api/contratos/2/assinar
```

## Códigos de resposta

| Código | Quando |
|---|---|
| 200 | consulta ou atualização feita |
| 201 | registro criado (devolve o registro) |
| 204 | exclusão feita (sem corpo) |
| 400 | dado inválido (campo obrigatório, data impossível, status fora da lista) |
| 401 | login inválido |
| 404 | registro ou rota inexistente |
| 409 | duplicidade ou registro em uso (ex.: contrato repetido, serviço com contrato) |
| 503 | banco indisponível |

## Integração com a interface

O site já consome esta API. O arquivo `assets/banco.js` decide, ao abrir a página,
se usa a API ou o armazenamento local:

1. faz `GET /api/health` (timeout de 2,5 s);
2. se responder `{"ok":true}`, carrega os dados por `GET` e passa a gravar por
   `POST`/`PATCH`/`PUT`/`DELETE`;
3. se não responder, usa `localStorage` — a interface continua funcionando.

O endereço padrão é `http://localhost:3000/api`. Para apontar para outro servidor,
basta declarar antes dos scripts:

```html
<script>window.LIRIOS_API = 'http://192.168.0.10:3000/api';</script>
```

Credenciais criadas pelo `seed.sql`: **katlhen@lirios.com.br** / **senha1234**
(já preenchidas na tela de login para facilitar a demonstração).

## Decisões de implementação

- **Validação antes do banco.** Todo campo passa por `server/http.js`; erros viram
  400 com mensagem em português, sem chegar ao SQL.
- **Datas validadas no calendário**, não só no formato: `2026-02-30` e
  `2026-13-40` são recusados.
- **`dateStrings: true`** no pool. Evita o deslocamento de fuso que o driver faz
  ao converter `DATE`/`DATETIME` em objeto `Date` — `2026-10-27` chega como
  `'2026-10-27'`, não como `2026-10-26T23:00:00`.
- **Transações** em atendimentos (atendimento + exames) e nas substituições de
  exames: ou grava tudo, ou não grava nada.
- **Regras no banco e na API.** A API valida o formato; o banco garante o resto
  (`CHECK`, `UNIQUE`, chaves estrangeiras). Quando o MySQL recusa, o erro é
  traduzido (409/400) em vez de virar 500.
- **Login ainda sem token.** O `/api/auth/login` confere a senha (bcrypt) e devolve
  o usuário; as rotas não exigem autenticação nesta etapa. O próximo passo é
  emitir JWT e proteger as rotas de escrita.

## Testes

```bash
npm test
```

Os testes sobem a API com um **dublê do pool** (não precisam de MySQL) e verificam:

- `/api/health`, 404 e preflight CORS;
- 14 casos de validação que devem responder 400/401;
- 40 fluxos de sucesso (GET/POST/PUT/PATCH/DELETE em todos os recursos);
- o SQL gerado por todas as rotas, validado no dialeto MySQL (opcional: requer
  `node-sql-parser`).

Resultado atual: **61 verificações, todas passando**.
