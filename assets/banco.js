/* ============================================================================
   INSTITUTO LÍRIOS — camada de dados
   assets/banco.js
   ----------------------------------------------------------------------------
   Uma única interface (Banco) com dois backends:

     modo "api"    -> conversa com a API em server/ (Node + Express + MySQL)
     modo "local"  -> usa localStorage (funciona mesmo sem o servidor)

   Na abertura da página, Banco.carregar() testa /api/health. Se a API
   responder, os dados vêm do MySQL; se não, tudo continua funcionando
   com os dados locais. Assim a demonstração nunca quebra.

   Leituras são síncronas (o cache é preenchido no carregar), para não obrigar
   await em cada render. Escritas são assíncronas e atualizam o cache.
   ============================================================================ */
(function (global) {
  'use strict';

  var API_PADRAO = 'http://localhost:3000/api';

  var CHAVE = {
    clientes: 'lirios:clientes:v2',
    atendimentos: 'lirios:atendimentos:v2',
    exames: 'lirios:exames:v2',
    contratos: 'lirios:contratos:v2',
    agenda: 'lirios:agenda:v2',
    pendencias: 'lirios:pendencias:v2',
    servicos: 'lirios:servicos:v2',
    sequencia: 'lirios:sequencia:v2'
  };

  var ROTULOS = {
    parto: { normal: 'Normal', cesarea: 'Cesárea', a_definir: 'A definir' },
    sexo: { feminino: 'Feminino', masculino: 'Masculino', nao_informado: 'Ainda não sabe' },
    mov: { ativas: 'Ativas', pouco_ativas: 'Pouco ativas', ainda_nao_sente: 'Ainda não sente' },
    status: { ativa: 'Ativa', pendente: 'Pendente', inativa: 'Inativa' }
  };

  /* ------------------------------ utilidades ------------------------------ */

  function pad(n) { return String(n).padStart(2, '0'); }

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function somarDias(iso, dias) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  function normalizar(texto) {
    return String(texto == null ? '' : texto).trim().toLowerCase();
  }

  function inverter(mapa) {
    return Object.keys(mapa).reduce(function (acc, chave) {
      acc[mapa[chave]] = chave;
      return acc;
    }, {});
  }

  var PART0_INV = inverter(ROTULOS.parto);
  var SEXO_INV = inverter(ROTULOS.sexo);
  var MOV_INV = inverter(ROTULOS.mov);

  /** 'DD/MM/AAAA' ou 'AAAA-MM-DD' -> 'AAAA-MM-DD' */
  function paraISO(valor) {
    var texto = String(valor == null ? '' : valor).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
    var br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return br ? br[3] + '-' + br[2] + '-' + br[1] : '';
  }

  function lerLocal(chave) {
    try {
      var bruto = global.localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      console.warn('[Banco] falha ao ler ' + chave, erro);
      return null;
    }
  }

  function gravarLocal(chave, valor) {
    try {
      global.localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (erro) {
      console.warn('[Banco] falha ao gravar ' + chave, erro);
      return false;
    }
  }

  /**
   * Próximo id do modo local. Considera o maior id já existente em todas as
   * coleções — senão o primeiro registro criado repetiria o id 1 dos dados
   * iniciais e as buscas por id passariam a devolver o registro errado.
   */
  function proximoId() {
    var maior = Number(lerLocal(CHAVE.sequencia) || 0);

    ['clientes', 'atendimentos', 'contratos', 'agenda', 'pendencias', 'servicos'].forEach(function (colecao) {
      (Banco[colecao] || []).forEach(function (item) {
        if (Number(item.id) > maior) maior = Number(item.id);
      });
    });

    var novo = maior + 1;
    gravarLocal(CHAVE.sequencia, novo);
    return novo;
  }

  /* --------------------------------- seeds -------------------------------- */

  function gestacaoSeed() {
    var dum = somarDias(hojeISO(), -259);
    return {
      id: 1,
      dum: dum,
      dpp: somarDias(dum, 280),
      parto: 'Normal',
      bebe: 'Helena',
      sexo: 'Feminino',
      mov: 'Ativas',
      obs: 'Cliente relata desconforto lombar leve. Acompanhamento dentro do esperado.'
    };
  }

  function servicosSeed() {
    return [
      { id: 1, nome: 'Pré-natal', descricao: 'Consultas de acompanhamento da gestação, com orientações e solicitação de exames.', duracao_min: 60, valor: 250, ativo: 1 },
      { id: 2, nome: 'Puericultura', descricao: 'Acompanhamento do crescimento e desenvolvimento do bebê.', duracao_min: 45, valor: 180, ativo: 1 },
      { id: 3, nome: 'Consultoria de Amamentação', descricao: 'Apoio na pega, posições e dificuldades durante a amamentação.', duracao_min: 60, valor: 200, ativo: 1 },
      { id: 4, nome: 'Auriculoterapia', descricao: 'Sessões de auriculoterapia para alívio de desconfortos da gestação.', duracao_min: 50, valor: 120, ativo: 1 },
      { id: 5, nome: 'Perfuração Humanizada', descricao: 'Perfuração de orelha com técnica humanizada.', duracao_min: 40, valor: 80, ativo: 1 }
    ];
  }

  function clientesSeed() {
    var base = [
      ['Maria Silva', '000.000.000-00', '1995-05-15', '(99) 99999-0001', 'maria@email.com', 1, 'Ativa'],
      ['Ana Sousa', '', '1998-03-22', '(99) 99999-0002', 'ana@email.com', 2, 'Ativa'],
      ['Carla Lima', '', '1992-11-07', '(99) 99999-0003', 'carla@email.com', 3, 'Ativa'],
      ['Júlia Alves', '', '2001-06-14', '(99) 99999-0004', 'julia@email.com', 4, 'Ativa'],
      ['Fernanda Rocha', '', '1996-09-30', '(99) 99999-0005', 'fernanda@email.com', 5, 'Ativa'],
      ['Mariana Costa', '', '1999-01-18', '(99) 99999-0006', 'mariana@email.com', 1, 'Ativa'],
      ['Carla Rocha', '', '1994-07-02', '(99) 99999-0007', 'carla.rocha@email.com', 1, 'Pendente']
    ];

    return base.map(function (linha, indice) {
      return {
        id: indice + 1,
        nome: linha[0],
        cpf: linha[1],
        nascimento: linha[2],
        telefone: linha[3],
        email: linha[4],
        cidade: 'Balsas - MA',
        servico_principal_id: linha[5],
        servico: servicosSeed()[linha[5] - 1].nome,
        status: linha[6],
        gestacao: linha[0] === 'Maria Silva' ? gestacaoSeed() : null
      };
    });
  }

  function atendimentosSeed() {
    var base = [
      { dias: -17, servico: 'Pré-natal', exames: ['Hemograma completo'], anotacoes: 'Consulta de rotina. Gestação evoluindo sem intercorrências.' },
      { dias: -31, servico: 'Consultoria de Amamentação', exames: [], anotacoes: 'Orientações sobre pega e posicionamento.' },
      { dias: -45, servico: 'Pré-natal', exames: ['Ultrassom obstétrico'], anotacoes: 'Avaliação inicial do pré-natal.' }
    ];

    return base.map(function (item, indice) {
      return {
        id: indice + 1,
        cliente_id: 1,
        cliente: 'Maria Silva',
        servico: item.servico,
        data: somarDias(hojeISO(), item.dias),
        profissional: 'Dra. Katlhen Carvalho',
        anotacoes: item.anotacoes,
        bpm: '145',
        movimentacoes: 'Ativas',
        exames: item.exames,
        emocional: 'Tranquila com o acompanhamento.'
      };
    });
  }

  function contratosSeed() {
    var base = [
      ['Maria Silva', 1, 'Pré-natal', 'Assinado', 250],
      ['Ana Sousa', 2, 'Puericultura', 'Pendente', 180],
      ['Carla Lima', 3, 'Consultoria de Amamentação', 'Assinado', 200],
      ['Júlia Alves', 4, 'Auriculoterapia', 'Pendente', 120],
      ['Fernanda Rocha', 1, 'Pré-natal', 'Assinado', 250]
    ];

    return base.map(function (linha, indice) {
      return {
        id: indice + 1,
        cliente_id: indice + 1,
        cliente: linha[0],
        servico_id: linha[1],
        servico: linha[2],
        status: linha[3],
        assinado: linha[3] === 'Assinado',
        valor: linha[4]
      };
    });
  }

  function agendaSeed() {
    var base = [
      { dias: 0, hora: '09:30', cliente: 'Maria Silva', servico: 'Pré-natal', duracao: 60 },
      { dias: 4, hora: '10:30', cliente: 'Ana Sousa', servico: 'Puericultura', duracao: 45 },
      { dias: 9, hora: '14:00', cliente: 'Carla Lima', servico: 'Consultoria de Amamentação', duracao: 60 },
      { dias: 16, hora: '16:00', cliente: 'Júlia Alves', servico: 'Auriculoterapia', duracao: 50 }
    ];

    return base.map(function (item, indice) {
      return {
        id: indice + 1,
        cliente: item.cliente,
        servico: item.servico,
        inicio: somarDias(hojeISO(), item.dias) + ' ' + item.hora + ':00',
        duracao_min: item.duracao,
        status: 'agendado',
        observacao: ''
      };
    });
  }

  function pendenciasSeed() {
    var base = [
      ['Maria Silva', 1, 'contrato', 'Contrato aguardando assinatura'],
      ['Ana Sousa', 2, 'exame', 'Exame pendente'],
      ['Carla Lima', 3, 'confirmacao', 'Confirmar consulta'],
      ['Júlia Alves', 4, 'anotacao', 'Anotação do atendimento']
    ];

    return base.map(function (linha, indice) {
      return {
        id: indice + 1,
        cliente_id: linha[1],
        cliente: linha[0],
        tipo: linha[2],
        descricao: linha[3],
        status: 'aberta'
      };
    });
  }

  /* ------------------------------ normalização ---------------------------- */

  function clienteDaApi(bruto, gestacoes) {
    var gestacao = null;

    if (gestacoes && Array.isArray(gestacoes)) {
      var aberta = gestacoes.filter(function (g) {
        return Number(g.cliente_id) === Number(bruto.id) && !g.encerrada_em;
      })[0];

      if (aberta) {
        gestacao = {
          id: aberta.id,
          dum: aberta.dum,
          dpp: aberta.dpp,
          parto: ROTULOS.parto[aberta.tipo_parto] || 'A definir',
          bebe: aberta.bebe_nome || '',
          sexo: ROTULOS.sexo[aberta.bebe_sexo] || 'Ainda não sabe',
          mov: ROTULOS.mov[aberta.movimentacoes] || 'Ativas',
          obs: aberta.observacoes || ''
        };
      }
    }

    return {
      id: bruto.id,
      nome: bruto.nome,
      cpf: bruto.cpf || '',
      nascimento: paraISO(bruto.data_nascimento),
      telefone: bruto.telefone || '',
      email: bruto.email || '',
      cidade: bruto.cidade || '',
      servico_principal_id: bruto.servico_principal_id,
      servico: bruto.servico_principal || '',
      status: ROTULOS.status[String(bruto.status).toLowerCase()] || 'Ativa',
      gestacao: gestacao
    };
  }

  function atendimentoDaApi(bruto) {
    var exames = (bruto.exames || []).map(function (e) {
      return typeof e === 'string' ? e : e.nome;
    });

    return {
      id: bruto.id,
      cliente_id: bruto.cliente_id,
      cliente: bruto.cliente,
      servico: bruto.servico || '',
      data: bruto.data_atendimento,
      profissional: bruto.profissional || '',
      anotacoes: bruto.anotacoes || '',
      bpm: bruto.bpm || '',
      movimentacoes: bruto.movimentacoes || '',
      exames: exames,
      emocional: bruto.estado_emocional || ''
    };
  }

  function contratoDaApi(bruto) {
    return {
      id: bruto.id,
      cliente_id: bruto.cliente_id,
      cliente: bruto.cliente,
      servico_id: bruto.servico_id,
      servico: bruto.servico,
      status: bruto.status === 'assinado' ? 'Assinado' : (bruto.status === 'cancelado' ? 'Cancelado' : 'Pendente'),
      assinado: bruto.status === 'assinado',
      valor: bruto.valor
    };
  }

  function agendamentoDaApi(bruto) {
    return {
      id: bruto.id,
      cliente_id: bruto.cliente_id,
      cliente: bruto.cliente,
      servico: bruto.servico,
      servico_id: bruto.servico_id,
      inicio: String(bruto.inicio).slice(0, 19),
      duracao_min: bruto.duracao_min,
      status: bruto.status,
      observacao: bruto.observacao || ''
    };
  }

  function pendenciaDaApi(bruto) {
    return {
      id: bruto.id,
      cliente_id: bruto.cliente_id,
      cliente: bruto.cliente,
      tipo: bruto.tipo,
      descricao: bruto.descricao,
      status: bruto.status
    };
  }

  function servicoDaApi(bruto) {
    return {
      id: bruto.id,
      nome: bruto.nome,
      descricao: bruto.descricao || '',
      duracao_min: bruto.duracao_min,
      valor: bruto.valor,
      ativo: bruto.ativo
    };
  }

  /* ---------------------------------- API --------------------------------- */

  var Banco = {
    modo: 'local',
    baseUrl: API_PADRAO,
    erro: null,

    clientes: [],
    atendimentos: [],
    exames: [],
    contratos: [],
    agenda: [],
    pendencias: [],
    servicos: [],
    dashboard: null,

    /* ------------------------------- carga -------------------------------- */

    carregar: async function () {
      Banco.baseUrl = global.LIRIOS_API || API_PADRAO;

      if (typeof global.fetch !== 'function') {
        Banco.modo = 'local';
        Banco.carregarLocal();
        return Banco.modo;
      }

      try {
        var saude = await Banco.pedir('/health', { timeout: 2500 });
        if (!saude || !saude.ok) throw new Error('banco indisponível');
        await Banco.carregarApi();
        Banco.modo = 'api';
      } catch (erro) {
        console.warn('[Banco] API indisponível, usando dados locais:', erro.message);
        Banco.erro = erro;
        Banco.modo = 'local';
        Banco.carregarLocal();
      }

      return Banco.modo;
    },

    carregarApi: async function () {
      var respostas = await Promise.all([
        Banco.pedir('/clientes'),
        Banco.pedir('/gestacoes'),
        Banco.pedir('/atendimentos'),
        Banco.pedir('/atendimentos/exames'),
        Banco.pedir('/contratos'),
        Banco.pedir('/agenda'),
        Banco.pedir('/pendencias'),
        Banco.pedir('/servicos')
      ]);

      var gestacoes = respostas[1] || [];

      Banco.clientes = (respostas[0] || []).map(function (bruto) {
        return clienteDaApi(bruto, gestacoes);
      });
      Banco.atendimentos = (respostas[2] || []).map(atendimentoDaApi);
      Banco.exames = respostas[3] || [];
      Banco.contratos = (respostas[4] || []).map(contratoDaApi);
      Banco.agenda = (respostas[5] || []).map(agendamentoDaApi);
      Banco.pendencias = (respostas[6] || []).map(pendenciaDaApi);
      Banco.servicos = (respostas[7] || []).map(servicoDaApi);
    },

    carregarLocal: function () {
      Banco.servicos = lerLocal(CHAVE.servicos) || servicosSeed();
      Banco.clientes = lerLocal(CHAVE.clientes) || clientesSeed();
      Banco.atendimentos = lerLocal(CHAVE.atendimentos) || atendimentosSeed();
      Banco.contratos = lerLocal(CHAVE.contratos) || contratosSeed();
      Banco.agenda = lerLocal(CHAVE.agenda) || agendaSeed();
      Banco.pendencias = lerLocal(CHAVE.pendencias) || pendenciasSeed();
      Banco.exames = Banco.montarExames();
    },

    salvarLocal: function (chave, valor) {
      if (Banco.modo === 'local') gravarLocal(chave, valor);
    },

    /** Lista plana de exames, no mesmo formato que a API devolve. */
    montarExames: function () {
      var lista = [];
      Banco.atendimentos.forEach(function (atendimento) {
        (atendimento.exames || []).forEach(function (nome) {
          lista.push({
            cliente_id: atendimento.cliente_id,
            nome: nome,
            data: atendimento.data
          });
        });
      });
      return lista;
    },

    /* ------------------------------- HTTP ---------------------------------- */

    pedir: async function (caminho, opcoes) {
      var config = opcoes || {};
      var controle = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = null;

      if (controle && config.timeout) {
        timer = global.setTimeout(function () { controle.abort(); }, config.timeout);
      }

      try {
        var resposta = await global.fetch(Banco.baseUrl + caminho, {
          method: config.method || 'GET',
          headers: config.corpo ? { 'Content-Type': 'application/json' } : undefined,
          body: config.corpo ? JSON.stringify(config.corpo) : undefined,
          signal: controle ? controle.signal : undefined
        });

        var texto = await resposta.text();
        var dados = null;
        if (texto) {
          try { dados = JSON.parse(texto); } catch (erro) { dados = texto; }
        }

        if (!resposta.ok) {
          var mensagem = (dados && dados.erro) ? dados.erro : 'Erro ' + resposta.status;
          var problema = new Error(mensagem);
          problema.status = resposta.status;
          problema.detalhes = dados && dados.detalhes;
          throw problema;
        }

        return dados;
      } finally {
        if (timer) global.clearTimeout(timer);
      }
    },

    /* ---------------------------- clientes -------------------------------- */

    listarClientes: function (filtro) {
      var busca = normalizar(filtro && filtro.busca);
      var status = normalizar(filtro && filtro.status);

      return Banco.clientes.filter(function (cliente) {
        var combinaBusca = !busca ||
          normalizar(cliente.nome).indexOf(busca) !== -1 ||
          normalizar(cliente.servico).indexOf(busca) !== -1 ||
          normalizar(cliente.email).indexOf(busca) !== -1 ||
          normalizar(cliente.telefone).indexOf(busca) !== -1;
        var combinaStatus = !status || normalizar(cliente.status) === status;
        return combinaBusca && combinaStatus;
      });
    },

    criarCliente: async function (dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/clientes', {
          method: 'POST',
          corpo: {
            nome: dados.nome,
            cpf: dados.cpf || null,
            data_nascimento: dados.nascimento || null,
            telefone: dados.telefone || null,
            email: dados.email || null,
            cidade: dados.cidade || null,
            servico_principal_id: dados.servico_principal_id || null,
            status: normalizar(dados.status) || 'ativa'
          }
        });
        var gestacoes = await Banco.pedir('/gestacoes');
        var cliente = clienteDaApi(bruto, gestacoes);
        Banco.clientes.push(cliente);
        return cliente;
      }

      var novo = {
        id: proximoId(),
        nome: dados.nome,
        cpf: dados.cpf || '',
        nascimento: dados.nascimento || '',
        telefone: dados.telefone || '',
        email: dados.email || '',
        cidade: dados.cidade || 'Balsas - MA',
        servico_principal_id: dados.servico_principal_id || null,
        servico: dados.servico || '',
        status: dados.status || 'Ativa',
        gestacao: null
      };
      Banco.clientes.push(novo);
      Banco.salvarLocal(CHAVE.clientes, Banco.clientes);
      return novo;
    },

    atualizarCliente: async function (idOuCliente, mudancas) {
      var alvo = typeof idOuCliente === 'object'
        ? idOuCliente
        : Banco.clientes.filter(function (c) { return Number(c.id) === Number(idOuCliente); })[0];

      if (!alvo) throw new Error('Cliente não encontrada.');

      if (Banco.modo === 'api') {
        var corpo = {};
        if ('nome' in mudancas) corpo.nome = mudancas.nome;
        if ('cpf' in mudancas) corpo.cpf = mudancas.cpf || null;
        if ('nascimento' in mudancas) corpo.data_nascimento = mudancas.nascimento || null;
        if ('telefone' in mudancas) corpo.telefone = mudancas.telefone || null;
        if ('email' in mudancas) corpo.email = mudancas.email || null;
        if ('cidade' in mudancas) corpo.cidade = mudancas.cidade || null;
        if ('servico_principal_id' in mudancas) corpo.servico_principal_id = mudancas.servico_principal_id || null;
        if ('status' in mudancas) corpo.status = normalizar(mudancas.status);

        var bruto = await Banco.pedir('/clientes/' + alvo.id, { method: 'PATCH', corpo: corpo });
        var gestacoes = await Banco.pedir('/gestacoes');
        var atualizado = clienteDaApi(bruto, gestacoes);
        atualizado.gestacao = alvo.gestacao;   // preserva o que a ficha já tinha
        Object.assign(alvo, atualizado);
        return alvo;
      }

      Object.keys(mudancas).forEach(function (campo) { alvo[campo] = mudancas[campo]; });
      if ('servico_principal_id' in mudancas) {
        var servico = Banco.servicos.filter(function (s) {
          return Number(s.id) === Number(mudancas.servico_principal_id);
        })[0];
        alvo.servico = servico ? servico.nome : alvo.servico;
      }
      Banco.salvarLocal(CHAVE.clientes, Banco.clientes);
      return alvo;
    },

    removerCliente: async function (cliente) {
      if (Banco.modo === 'api') {
        await Banco.pedir('/clientes/' + cliente.id, { method: 'DELETE' });
        await Banco.carregarApi();
        return;
      }
      Banco.clientes = Banco.clientes.filter(function (c) { return c !== cliente; });
      Banco.salvarLocal(CHAVE.clientes, Banco.clientes);
    },

    /* ---------------------------- gestação -------------------------------- */

    salvarGestacao: async function (cliente, dados) {
      var mapa = {
        dum: dados.dum,
        tipo_parto: PART0_INV[dados.parto] || 'a_definir',
        bebe_nome: dados.bebe || null,
        bebe_sexo: SEXO_INV[dados.sexo] || 'nao_informado',
        movimentacoes: MOV_INV[dados.mov] || 'ativas',
        observacoes: dados.obs || null
      };

      if (Banco.modo === 'api') {
        var bruto;

        if (dados.id) {
          bruto = await Banco.pedir('/gestacoes/' + dados.id, { method: 'PUT', corpo: mapa });
        } else {
          mapa.cliente_id = cliente.id;
          bruto = await Banco.pedir('/gestacoes', { method: 'POST', corpo: mapa });
        }

        cliente.gestacao = {
          id: bruto.id,
          dum: bruto.dum,
          dpp: bruto.dpp,
          parto: ROTULOS.parto[bruto.tipo_parto],
          bebe: bruto.bebe_nome || '',
          sexo: ROTULOS.sexo[bruto.bebe_sexo],
          mov: ROTULOS.mov[bruto.movimentacoes],
          obs: bruto.observacoes || ''
        };
        return cliente.gestacao;
      }

      var dpp = somarDias(dados.dum, 280);
      cliente.gestacao = {
        id: cliente.gestacao ? cliente.gestacao.id : proximoId(),
        dum: dados.dum,
        dpp: dpp,
        parto: dados.parto,
        bebe: dados.bebe,
        sexo: dados.sexo,
        mov: dados.mov,
        obs: dados.obs
      };
      Banco.salvarLocal(CHAVE.clientes, Banco.clientes);
      return cliente.gestacao;
    },

    encerrarGestacao: async function (cliente) {
      if (!cliente.gestacao) return;

      if (Banco.modo === 'api') {
        await Banco.pedir('/gestacoes/' + cliente.gestacao.id + '/encerrar', { method: 'PATCH', corpo: {} });
      }

      cliente.gestacao = null;
      Banco.salvarLocal(CHAVE.clientes, Banco.clientes);
    },

    /* --------------------------- atendimentos ----------------------------- */

    atendimentosDoCliente: function (cliente) {
      return Banco.atendimentos
        .filter(function (registro) { return normalizar(registro.cliente) === normalizar(cliente.nome); })
        .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)) || (b.id - a.id); });
    },

    examesDoCliente: function (cliente) {
      return Banco.exames
        .filter(function (exame) { return Number(exame.cliente_id) === Number(cliente.id); })
        .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    },

    criarAtendimento: async function (dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/atendimentos', {
          method: 'POST',
          corpo: {
            cliente_id: dados.cliente_id,
            servico_id: dados.servico_id || null,
            profissional_id: dados.profissional_id || null,
            data_atendimento: dados.data,
            anotacoes: dados.anotacoes || null,
            bpm: dados.bpm ? Number(dados.bpm) : null,
            movimentacoes: dados.movimentacoes || null,
            estado_emocional: dados.emocional || null,
            exames: dados.exames || []
          }
        });

        var atendimento = atendimentoDaApi(bruto);
        Banco.atendimentos.unshift(atendimento);
        (bruto.exames || []).forEach(function (exame) {
          Banco.exames.push({ cliente_id: bruto.cliente_id, nome: exame.nome, data: bruto.data_atendimento });
        });
        return atendimento;
      }

      var novo = {
        id: proximoId(),
        cliente_id: dados.cliente_id,
        cliente: dados.cliente,
        servico: dados.servico,
        data: dados.data,
        profissional: dados.profissional,
        anotacoes: dados.anotacoes,
        bpm: dados.bpm,
        movimentacoes: dados.movimentacoes,
        exames: dados.exames || [],
        emocional: dados.emocional
      };
      Banco.atendimentos.unshift(novo);
      Banco.exames = Banco.montarExames();
      Banco.salvarLocal(CHAVE.atendimentos, Banco.atendimentos);
      return novo;
    },

    removerAtendimento: async function (atendimento) {
      if (Banco.modo === 'api') {
        await Banco.pedir('/atendimentos/' + atendimento.id, { method: 'DELETE' });
        Banco.atendimentos = Banco.atendimentos.filter(function (a) { return a.id !== atendimento.id; });
        Banco.exames = Banco.exames.filter(function (e) { return Number(e.cliente_id) !== Number(atendimento.cliente_id) || e.data !== atendimento.data; });
        return;
      }
      Banco.atendimentos = Banco.atendimentos.filter(function (a) { return a !== atendimento; });
      Banco.exames = Banco.montarExames();
      Banco.salvarLocal(CHAVE.atendimentos, Banco.atendimentos);
    },

    /* ----------------------------- contratos ------------------------------ */

    contratoDoCliente: function (cliente, servico) {
      return Banco.contratos.filter(function (contrato) {
        return normalizar(contrato.cliente) === normalizar(cliente.nome) &&
          (!servico || normalizar(contrato.servico) === normalizar(servico));
      })[0] || null;
    },

    assinarContrato: async function (contrato) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/contratos/' + contrato.id + '/assinar', { method: 'PATCH', corpo: {} });
        Object.assign(contrato, contratoDaApi(bruto));
      } else {
        contrato.status = 'Assinado';
        contrato.assinado = true;
        Banco.salvarLocal(CHAVE.contratos, Banco.contratos);
      }
      return contrato;
    },

    criarContrato: async function (dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/contratos', {
          method: 'POST',
          corpo: {
            cliente_id: dados.cliente_id,
            servico_id: dados.servico_id,
            valor: dados.valor || 0
          }
        });
        var contrato = contratoDaApi(bruto);
        Banco.contratos.push(contrato);
        return contrato;
      }

      var novo = {
        id: proximoId(),
        cliente_id: dados.cliente_id,
        cliente: dados.cliente,
        servico_id: dados.servico_id,
        servico: dados.servico,
        status: 'Pendente',
        assinado: false,
        valor: dados.valor || 0
      };
      Banco.contratos.push(novo);
      Banco.salvarLocal(CHAVE.contratos, Banco.contratos);
      return novo;
    },

    totaisContratos: function () {
      var total = Banco.contratos.length;
      var assinados = Banco.contratos.filter(function (c) { return c.assinado; }).length;
      return { total: total, assinados: assinados, pendentes: total - assinados };
    },

    /* ------------------------------- agenda ------------------------------- */

    /** Agrupa os agendamentos por dia, no formato que a tela usa. */
    eventosPorDia: function () {
      var mapa = {};

      Banco.agenda.forEach(function (agendamento) {
        var iso = String(agendamento.inicio).slice(0, 10);
        mapa[iso] = mapa[iso] || [];
        mapa[iso].push({
          id: agendamento.id,
          t: String(agendamento.inicio).slice(11, 16),
          w: agendamento.cliente,
          servico: agendamento.servico,
          observacao: agendamento.observacao,
          status: agendamento.status,
          c: ['peach', 'rose', 'clay'][agendamento.id % 3]
        });
      });

      Object.keys(mapa).forEach(function (iso) {
        mapa[iso].sort(function (a, b) { return a.t.localeCompare(b.t); });
      });

      return mapa;
    },

    criarAgendamento: async function (dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/agenda', {
          method: 'POST',
          corpo: {
            cliente_id: dados.cliente_id,
            servico_id: dados.servico_id,
            inicio: dados.inicio,
            observacao: dados.observacao || null
          }
        });
        var agendamento = agendamentoDaApi(bruto);
        Banco.agenda.push(agendamento);
        return agendamento;
      }

      var novo = {
        id: proximoId(),
        cliente: dados.cliente,
        servico: dados.servico,
        inicio: dados.inicio,
        duracao_min: 60,
        status: 'agendado',
        observacao: dados.observacao || ''
      };
      Banco.agenda.push(novo);
      Banco.salvarLocal(CHAVE.agenda, Banco.agenda);
      return novo;
    },

    removerAgendamento: async function (id) {
      if (Banco.modo === 'api') {
        await Banco.pedir('/agenda/' + id, { method: 'DELETE' });
      }
      Banco.agenda = Banco.agenda.filter(function (a) { return a.id !== id; });
      Banco.salvarLocal(CHAVE.agenda, Banco.agenda);
    },

    definirStatusAgendamento: async function (id, status) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/agenda/' + id + '/status', { method: 'PATCH', corpo: { status: status } });
        var alvo = Banco.agenda.filter(function (a) { return a.id === id; })[0];
        if (alvo) Object.assign(alvo, agendamentoDaApi(bruto));
        return;
      }
      Banco.agenda.forEach(function (a) { if (a.id === id) a.status = status; });
      Banco.salvarLocal(CHAVE.agenda, Banco.agenda);
    },

    /* ----------------------------- pendências ----------------------------- */

    pendenciasAbertas: function () {
      return Banco.pendencias.filter(function (p) { return p.status === 'aberta'; });
    },

    resolverPendencia: async function (pendencia) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/pendencias/' + pendencia.id + '/resolver', { method: 'PATCH', corpo: {} });
        Object.assign(pendencia, pendenciaDaApi(bruto));
      } else {
        pendencia.status = 'resolvida';
        Banco.salvarLocal(CHAVE.pendencias, Banco.pendencias);
      }
      return pendencia;
    },

    criarPendencia: async function (dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/pendencias', {
          method: 'POST',
          corpo: { cliente_id: dados.cliente_id, tipo: dados.tipo, descricao: dados.descricao }
        });
        var pendencia = pendenciaDaApi(bruto);
        Banco.pendencias.push(pendencia);
        return pendencia;
      }

      var novo = {
        id: proximoId(),
        cliente_id: dados.cliente_id,
        cliente: dados.cliente,
        tipo: dados.tipo || 'outro',
        descricao: dados.descricao,
        status: 'aberta'
      };
      Banco.pendencias.push(novo);
      Banco.salvarLocal(CHAVE.pendencias, Banco.pendencias);
      return novo;
    },

    /* ------------------------------ serviços ------------------------------ */

    servicoPorNome: function (nome) {
      return Banco.servicos.filter(function (s) { return normalizar(s.nome) === normalizar(nome); })[0] || null;
    },

    criarServico: async function (dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/servicos', { method: 'POST', corpo: dados });
        var servico = servicoDaApi(bruto);
        Banco.servicos.push(servico);
        return servico;
      }

      var novo = {
        id: proximoId(),
        nome: dados.nome,
        descricao: dados.descricao || '',
        duracao_min: Number(dados.duracao_min) || 60,
        valor: Number(dados.valor) || 0,
        ativo: 1
      };
      Banco.servicos.push(novo);
      Banco.salvarLocal(CHAVE.servicos, Banco.servicos);
      return novo;
    },

    atualizarServico: async function (servico, dados) {
      if (Banco.modo === 'api') {
        var bruto = await Banco.pedir('/servicos/' + servico.id, {
          method: 'PUT',
          corpo: {
            nome: dados.nome,
            descricao: dados.descricao || null,
            duracao_min: Number(dados.duracao_min) || 60,
            valor: Number(dados.valor) || 0,
            ativo: servico.ativo !== 0
          }
        });
        Object.assign(servico, servicoDaApi(bruto));
      } else {
        servico.nome = dados.nome;
        servico.descricao = dados.descricao || '';
        servico.duracao_min = Number(dados.duracao_min) || 60;
        servico.valor = Number(dados.valor) || 0;
        Banco.salvarLocal(CHAVE.servicos, Banco.servicos);
      }
      return servico;
    },

    /* ------------------------------ dashboard ----------------------------- */

    carregarDashboard: async function () {
      if (Banco.modo === 'api') {
        Banco.dashboard = await Banco.pedir('/dashboard');
      } else {
        var hoje = hojeISO();
        Banco.dashboard = {
          consultas_hoje: Banco.agenda.filter(function (a) {
            return String(a.inicio).slice(0, 10) === hoje && a.status === 'agendado';
          }).length,
          partos_previstos: Banco.clientes.filter(function (c) {
            return c.gestacao && c.gestacao.dpp >= hoje;
          }).length,
          pendencias_abertas: Banco.pendenciasAbertas().length,
          agenda_hoje: Banco.agenda
            .filter(function (a) { return String(a.inicio).slice(0, 10) === hoje && a.status !== 'cancelado'; })
            .map(function (a) {
              return { inicio: a.inicio, cliente: a.cliente, servico: a.servico, status: a.status };
            }),
          proximos_partos: Banco.clientes
            .filter(function (c) { return c.gestacao && c.gestacao.dpp; })
            .map(function (c) { return { cliente: c.nome, dpp: c.gestacao.dpp }; })
            .sort(function (a, b) { return a.dpp.localeCompare(b.dpp); })
            .slice(0, 5),
          pendencias: Banco.pendenciasAbertas().slice(0, 5)
        };
      }
      return Banco.dashboard;
    }
  };

  global.Banco = Banco;
})(window);
