/* ============================================================================
   INSTITUTO LÍRIOS — Sistema de Gestão
   assets/app.js — ponto único de JavaScript da aplicação
   ----------------------------------------------------------------------------
   1. Utilidades e constantes
   2. Camada de modais (overlays, modal genérico, campos de formulário)
   3. Data do dashboard            (#todayDate)
   4. Clientes                     (busca, filtro, cadastro, ações da linha)
   5. Serviços                     (busca, cadastro, edição, ver clientes)
   6. Abas                         (ficha da cliente)
   7. Resumo inteligente           (simulação de IA + copiar)
   8. Ficha da cliente             (editar dados)
   9. Atendimento                  (exames, salvar, cancelar)
  10. Contratos                    (ver, assinar, ações)
  11. Pendências                   (ações, resolver)
  12. Relatórios                   (período)
  13. Agenda                       (Dia/Semana/Mês, modais, localStorage)
   ----------------------------------------------------------------------------
   Nenhuma página tem <script> inline. Cada bloco procura seus elementos e
   encerra se a página não os tiver.
   ============================================================================ */
(function () {
  'use strict';

  /* ------------------------- 1. Utilidades e constantes ------------------- */

  var DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  var SERVICOS = [
    'Pré-natal',
    'Puericultura',
    'Consultoria de Amamentação',
    'Auriculoterapia',
    'Perfuração Humanizada'
  ];

  var CORES = ['peach', 'rose', 'clay'];

  /** Texto para comparação (minúsculo, sem espaços nas pontas). */
  function normalizar(texto) {
    return String(texto == null ? '' : texto).trim().toLowerCase();
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function toISODate(data) {
    return data.getFullYear() + '-' + pad(data.getMonth() + 1) + '-' + pad(data.getDate());
  }

  function fromISODate(iso) {
    var p = String(iso).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function formatarBR(iso) {
    var p = String(iso).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function capitalizar(texto) {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
  }

  function esc(valor) {
    var mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) { return mapa[c]; });
  }

  function hojeISO() { return toISODate(new Date()); }

  /** 'AAAA-MM-DD' -> 'DD/MM/AAAA'. */
  function nascimentoBR(iso) {
    var partes = String(iso || '').split('-');
    return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : (iso || '—');
  }

  /** Idade em anos completos a partir da data de nascimento (ISO). */
  function idadeDe(iso) {
    var partes = String(iso || '').split('-').map(Number);
    if (partes.length !== 3 || !partes[0]) return '';

    var hoje = new Date();
    var idade = hoje.getFullYear() - partes[0];
    var meses = (hoje.getMonth() + 1) - partes[1];
    if (meses < 0 || (meses === 0 && hoje.getDate() < partes[2])) idade--;
    if (idade < 0 || idade > 120) return '';

    return idade + (idade === 1 ? ' ano' : ' anos');
  }

  /** Aceita 'AAAA-MM-DD' ou 'DD/MM/AAAA' e devolve sempre ISO. */
  function normalizarNascimento(valor) {
    var texto = String(valor == null ? '' : valor).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

    var br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return br[3] + '-' + br[2] + '-' + br[1];

    return '';
  }

  function iniciais(nome) {
    var partes = String(nome || '').trim().split(/\s+/);
    return ((partes[0] || '')[0] || '') + ((partes[1] || '')[0] || '');
  }

  function preencher(id, texto) {
    var el = document.getElementById(id);
    if (el) el.textContent = texto;
  }

  function toast(mensagem) {
    var el = document.getElementById('appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    // Mensagens de erro ou de campo errado ficam vermelhas e duram mais, para dar tempo de ler.
    var ehErro = /inv[aá]lid|n[aã]o [eé] poss|n[aã]o foi poss|n[aã]o pode|n[aã]o encontr|n[aã]o (est[aá]|existe)|j[aá] existe|j[aá] passou|informe|preencha|escolha|selecione|deve |obrigat|erro|falh|indispon|conflito|em uso|expirad|incorret/i
      .test(String(mensagem));
    el.textContent = mensagem;
    el.classList.toggle('toast-erro', ehErro);
    el.classList.add('show');
    window.clearTimeout(el._timer);
    el._timer = window.setTimeout(function () { el.classList.remove('show'); }, ehErro ? 6500 : 3400);
  }

  function copiarTexto(texto) {
    if (!texto) return Promise.reject(new Error('nada para copiar'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (erro) {
        reject(erro);
      }
      document.body.removeChild(area);
    });
  }

  /* ------------------------------ 2. Modais ------------------------------- */

  var ultimoFoco = null;

  function abrirOverlay(el) {
    if (!el) return;
    // Só guarda o foco de origem se nenhum modal estiver aberto: ao trocar de
    // um modal para outro, o elemento anterior deixaria de estar visível.
    if (!document.querySelector('.modal-overlay.active')) {
      ultimoFoco = document.activeElement;
    }
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function fecharOverlay(el) {
    if (!el) return;
    el.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
    if (ultimoFoco && typeof ultimoFoco.focus === 'function') ultimoFoco.focus();
    ultimoFoco = null;
  }

  function fecharGenerico() {
    fecharOverlay(document.getElementById('modalGenerico'));
  }

  function iniciarOverlays() {
    Array.prototype.forEach.call(document.querySelectorAll('.modal-overlay'), function (overlay) {
      overlay.addEventListener('click', function (evento) {
        if (evento.target === overlay) fecharOverlay(overlay);
      });
    });

    document.addEventListener('click', function (evento) {
      var fechar = evento.target.closest('[data-fechar]');
      if (fechar) fecharOverlay(fechar.closest('.modal-overlay'));
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Escape') return;
      Array.prototype.forEach.call(document.querySelectorAll('.modal-overlay.active'), function (el) {
        el.classList.remove('active');
      });
      document.body.style.overflow = '';
    });
  }

  /** Modal único reaproveitado por todas as ações da interface. */
  function modalGenerico(config) {
    var overlay = document.getElementById('modalGenerico');
    if (!overlay) return null;

    var titulo = document.getElementById('modalGenericoTitulo');
    var subtitulo = document.getElementById('modalGenericoSub');
    var corpo = document.getElementById('modalGenericoCorpo');
    var acoes = document.getElementById('modalGenericoAcoes');

    titulo.textContent = config.titulo || '';
    subtitulo.textContent = config.subtitulo || '';
    subtitulo.hidden = !config.subtitulo;
    corpo.innerHTML = config.html || '';
    acoes.innerHTML = '';

    (config.acoes || [{ rotulo: 'Fechar' }]).forEach(function (acao) {
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn ' + (acao.variante === 'primary' ? 'btn-primary' : 'btn-ghost');
      botao.textContent = acao.rotulo;
      botao.addEventListener('click', function () {
        if (typeof acao.aoClicar === 'function') acao.aoClicar({ corpo: corpo });
        else fecharGenerico();
      });
      acoes.appendChild(botao);
    });

    abrirOverlay(overlay);
    var primeiro = corpo.querySelector('input, select, textarea');
    if (primeiro) primeiro.focus();

    return { corpo: corpo };
  }

  /** HTML de um campo de formulário do modal genérico. */
  /* ----------------- campos de tamanho fixo (CPF, telefone, datas) ----------------- */

  function soDigitos(valor) { return String(valor == null ? '' : valor).replace(/\D/g, ''); }

  function formatarCpf(valor) {
    var n = soDigitos(valor).slice(0, 11);
    return n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  function formatarTelefone(valor) {
    var n = soDigitos(valor).slice(0, 11);
    if (n.length <= 2) return n ? '(' + n : '';
    if (n.length <= 6) return '(' + n.slice(0, 2) + ') ' + n.slice(2);
    if (n.length <= 10) return '(' + n.slice(0, 2) + ') ' + n.slice(2, 6) + '-' + n.slice(6);
    return '(' + n.slice(0, 2) + ') ' + n.slice(2, 7) + '-' + n.slice(7);
  }

  function cpfValido(valor) {
    var n = soDigitos(valor);
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    for (var tam = 9; tam <= 10; tam++) {
      var soma = 0;
      for (var i = 0; i < tam; i++) soma += Number(n.charAt(i)) * (tam + 1 - i);
      if (((soma * 10) % 11) % 10 !== Number(n.charAt(tam))) return false;
    }
    return true;
  }

  /** Confere CPF, telefone, e-mail e nascimento. Devolve a mensagem do 1º problema ou ''. */
  function erroDosDadosDaCliente(d) {
    if (d.cpf && !cpfValido(d.cpf)) return 'CPF inválido. Confira os 11 números.';
    if (d.telefone) {
      var t = soDigitos(d.telefone);
      if (t.length !== 10 && t.length !== 11) return 'Telefone deve ter DDD + 8 ou 9 números, ex.: (99) 99999-9999.';
      if (Number(t.slice(0, 2)) < 11) return 'O DDD do telefone é inválido.';
      if (t.length === 11 && t.charAt(2) !== '9') return 'Celular de 9 dígitos começa com 9 depois do DDD.';
    }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email).trim())) return 'O e-mail informado não é válido.';
    var nasc = d.nascimento;
    if (nasc && /^\d{4}-\d{2}-\d{2}$/.test(nasc)) {
      if (nasc < '1900-01-01') return 'A data de nascimento não pode ser anterior a 1900.';
      if (nasc > hojeISO()) return 'A data de nascimento não pode ser no futuro.';
    }
    return '';
  }

  /** Atributos de cada tipo de campo (limite de caracteres, máscara, faixa de data). */
  function atributosDoCampo(chave) {
    return {
      nome: { maxlength: 140 },
      cpf: { maxlength: 14, 'data-mascara': 'cpf', inputmode: 'numeric', placeholder: '000.000.000-00' },
      telefone: { maxlength: 15, 'data-mascara': 'telefone', inputmode: 'tel', placeholder: '(99) 99999-9999' },
      email: { maxlength: 160, placeholder: 'nome@email.com' },
      cidade: { maxlength: 120 },
      nascimento: { min: '1900-01-01', max: hojeISO() }
    }[chave] || {};
  }

  /** Aplica a máscara enquanto a pessoa digita (CPF e telefone). */
  function iniciarMascaras() {
    document.addEventListener('input', function (evento) {
      var alvo = evento.target;
      var tipo = alvo && alvo.getAttribute && alvo.getAttribute('data-mascara');
      if (tipo === 'cpf') alvo.value = formatarCpf(alvo.value);
      else if (tipo === 'telefone') alvo.value = formatarTelefone(alvo.value);
    });
  }

  function campoHTML(campo) {
    var id = 'campo-' + campo.nome;
    var rotulo = '<label class="field-label" for="' + id + '">' + esc(campo.label) + '</label>';
    var controle;

    if (campo.opcoes) {
      controle = '<select class="field-input field-select" id="' + id + '" data-campo="' + campo.nome + '">' +
        campo.opcoes.map(function (opcao) {
          // opção simples (texto) ou { valor, rotulo } (ex.: cliente: valor = id, rótulo = nome)
          var valorOpcao = typeof opcao === 'object' ? opcao.valor : opcao;
          var rotuloOpcao = typeof opcao === 'object' ? opcao.rotulo : opcao;
          return '<option value="' + esc(valorOpcao) + '"' +
            (valorOpcao === campo.valor ? ' selected' : '') + '>' + esc(rotuloOpcao) + '</option>';
        }).join('') + '</select>';
    } else if (campo.linha) {
      controle = '<textarea class="field-textarea" id="' + id + '" data-campo="' + campo.nome +
        '" rows="' + campo.linha + '" maxlength="255">' + esc(campo.valor || '') + '</textarea>';
    } else {
      var extras = '';
      var atributos = campo.attrs || {};
      Object.keys(atributos).forEach(function (chave) {
        extras += ' ' + chave + '="' + esc(atributos[chave]) + '"';
      });
      var valorCampo = campo.valor || '';
      if (atributos['data-mascara'] === 'cpf') valorCampo = formatarCpf(valorCampo);
      if (atributos['data-mascara'] === 'telefone') valorCampo = formatarTelefone(valorCampo);
      controle = '<input class="field-input" id="' + id + '" data-campo="' + campo.nome +
        '" type="' + (campo.tipo || 'text') + '" value="' + esc(valorCampo) + '"' + extras + '>';
    }

    return '<div class="field-group">' + rotulo + controle + '</div>';
  }

  function lerCampos(container) {
    var dados = {};
    Array.prototype.forEach.call(container.querySelectorAll('[data-campo]'), function (campo) {
      dados[campo.dataset.campo] = campo.value.trim();
    });
    return dados;
  }

  function estadoVazioDepoisDa(tabela, mensagem) {
    var vazio = document.createElement('p');
    vazio.className = 'table-empty';
    vazio.textContent = mensagem;
    vazio.style.display = 'none';
    if (tabela) tabela.insertAdjacentElement('afterend', vazio);
    return vazio;
  }

  /**
   * Na ficha e no atendimento o menu destaca "Clientes" (de onde a pessoa veio),
   * e só destaca "Gestantes" quando ela chegou pela lista de gestantes.
   */
  function iniciarMenuDaFicha() {
    var ehFicha = !!document.querySelector('.tab-panel[data-panel="dados"]') || /atendimento\.html/.test(window.location.pathname);
    if (!ehFicha) return;
    var veioDeGestantes = /gestantes\.html/.test(document.referrer || '');
    var linkClientes = document.querySelector('.nav a[href="clientes.html"], nav a[href="clientes.html"]');
    var linkGestantes = document.querySelector('nav a[href="gestantes.html"]');
    if (linkClientes) linkClientes.classList.toggle('active', !veioDeGestantes);
    if (linkGestantes) linkGestantes.classList.toggle('active', veioDeGestantes);
  }

  /* ----------------------------- Lista de gestantes ----------------------- */

  function iniciarGestantes() {
    var corpo = document.getElementById('gestanteTableBody');
    if (!corpo) return;

    var busca = document.getElementById('gestanteSearch');
    var resumo = document.getElementById('gestantesResumo');
    var vazio = estadoVazioDepoisDa(corpo.closest('table'), '');

    function diasEntre(deISO, ateISO) {
      return Math.round((fromISODate(ateISO) - fromISODate(deISO)) / 86400000);
    }

    function idadeGestacionalTexto(dum) {
      if (!dum) return '—';
      var dias = diasEntre(dum, hojeISO());
      if (isNaN(dias) || dias < 0) return '—';
      var semanas = Math.floor(dias / 7);
      var resto = dias % 7;
      return semanas + (semanas === 1 ? ' semana' : ' semanas') +
        (resto ? ' e ' + resto + (resto === 1 ? ' dia' : ' dias') : '');
    }

    function partoPrevisto(dpp) {
      if (!dpp) return '—';
      var dias = diasEntre(hojeISO(), dpp);
      if (isNaN(dias)) return '—';
      var quando = dias > 1 ? 'em ' + dias + ' dias' : dias === 1 ? 'amanhã' : dias === 0 ? 'hoje'
        : 'data já passou (' + Math.abs(dias) + (Math.abs(dias) === 1 ? ' dia' : ' dias') + ')';
      return formatarBR(dpp) + ' · ' + quando;
    }

    // Gestante = tem gestação registrada OU faz acompanhamento de gestação (Pré-natal) como serviço principal.
    function ehGestante(c) {
      return c.status !== 'Inativa' && (!!c.gestacao || /pr[eé]-?\s?natal|gesta/i.test(String(c.servico || '')));
    }

    function gestantes() {
      var termo = normalizar(busca ? busca.value : '');
      return carregarClientes()
        .filter(ehGestante)
        .filter(function (c) { return !termo || normalizar(c.nome).indexOf(termo) !== -1; })
        // quem está mais perto do parto aparece primeiro; sem data prevista vai para o fim, em ordem de nome
        .sort(function (a, b) {
          var da = String((a.gestacao && a.gestacao.dpp) || '9999');
          var db = String((b.gestacao && b.gestacao.dpp) || '9999');
          return da.localeCompare(db) || String(a.nome).localeCompare(String(b.nome));
        });
    }

    function desenhar() {
      var lista = gestantes();
      var total = carregarClientes().filter(ehGestante).length;

      corpo.innerHTML = '';
      lista.forEach(function (cliente) {
        var linha = document.createElement('tr');
        linha.dataset.destino = urlFicha(cliente);
        linha.dataset.clienteId = cliente.id;
        var g = cliente.gestacao;
        var semDados = '<span class="muted">Gestação não registrada</span>';
        linha.innerHTML =
          '<td class="name">' + esc(cliente.nome) + '</td>' +
          '<td>' + esc(cliente.servico || '—') + '</td>' +
          '<td>' + (g ? esc(idadeGestacionalTexto(g.dum)) : semDados) + '</td>' +
          '<td>' + (g ? esc(partoPrevisto(g.dpp)) : '<span class="muted">—</span>') + '</td>' +
          '<td>' + esc(cliente.telefone || '—') + '</td>';
        linha.addEventListener('click', function () { irPara(linha.dataset.destino); });
        corpo.appendChild(linha);
      });

      if (resumo) {
        resumo.textContent = total === 0 ? 'Nenhuma gestante em acompanhamento no momento'
          : total + (total === 1 ? ' gestante em acompanhamento' : ' gestantes em acompanhamento');
      }

      vazio.style.display = lista.length ? 'none' : '';
      vazio.textContent = total === 0
        ? 'Nenhuma gestante cadastrada. Aparecem aqui as clientes com gestação registrada ou com Pré-natal como serviço principal.'
        : 'Nenhuma gestante encontrada com esse nome.';
    }

    if (busca) busca.addEventListener('input', desenhar);
    desenhar();
  }

  /* --------------------------- 3. Data do dashboard ----------------------- */

  function iniciarDataAtual() {
    var el = document.getElementById('todayDate');
    if (!el) return;
    el.textContent = capitalizar(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }));
  }

  /* ------------------------- 4. Acesso aos dados -------------------------- */
  /* Os dados ficam em assets/banco.js, que carrega da API (MySQL) quando o
     servidor responde ou do localStorage quando não responde. As leituras são
     síncronas (cache); as gravações são assíncronas (Banco.xxx). */

  function carregarClientes() { return Banco.clientes; }
  function carregarAtendimentos() { return Banco.atendimentos; }
  function carregarContratos() { return Banco.contratos; }

  function acharClientePorNome(lista, nome) {
    var alvo = normalizar(nome);
    for (var i = 0; i < lista.length; i++) {
      if (normalizar(lista[i].nome) === alvo) return lista[i];
    }
    return null;
  }

  /** Cliente pelo id (o nome pode se repetir; o id nunca). */
  function acharClientePorId(lista, id) {
    if (id === undefined || id === null || id === '') return null;
    var alvo = Number(id);
    for (var i = 0; i < lista.length; i++) {
      if (Number(lista[i].id) === alvo) return lista[i];
    }
    return null;
  }

  /** Cliente indicada em ?cliente= (id; links antigos com nome ainda funcionam). Nunca adivinha outra. */
  function clienteDaUrl(lista) {
    var pedido = new URLSearchParams(window.location.search).get('cliente') || '';
    var achada = null;
    if (pedido) achada = /^\d+$/.test(pedido) ? acharClientePorId(lista, pedido) : acharClientePorNome(lista, pedido);
    return { pedido: pedido, cliente: achada };
  }

  /** Opções de <select> de clientes: valor = id. Se há nomes repetidos, o rótulo ajuda a distinguir. */
  function opcoesDeClientes(lista) {
    var repeticoes = {};
    lista.forEach(function (c) { repeticoes[normalizar(c.nome)] = (repeticoes[normalizar(c.nome)] || 0) + 1; });
    return lista.map(function (c) {
      var rotulo = c.nome;
      if (repeticoes[normalizar(c.nome)] > 1) {
        var detalhe = [c.nascimento ? 'nasc. ' + nascimentoBR(c.nascimento) : '', c.telefone]
          .filter(Boolean).join(' · ');
        rotulo += ' — ' + (detalhe || 'cadastro nº ' + c.id);
      }
      return { valor: String(c.id), rotulo: rotulo };
    });
  }

  /** Nomes de serviço para os selects (do banco, com reserva na lista fixa). */
  function nomesDeServico() {
    var nomes = Banco.servicos.map(function (servico) { return servico.nome; });
    return nomes.length ? nomes : SERVICOS;
  }

  /** Nome do serviço -> id (para gravar servico_principal_id). */
  function servicoIdPorNome(nome) {
    var servico = null;
    Banco.servicos.forEach(function (item) {
      if (normalizar(item.nome) === normalizar(nome)) servico = item;
    });
    return servico ? servico.id : null;
  }

  /** Aceita a cliente (objeto), o id, ou — só para links antigos — o nome. */
  function refDaCliente(cliente) {
    if (cliente && typeof cliente === 'object') return cliente.id != null ? cliente.id : cliente.nome;
    return cliente;
  }

  function urlFicha(cliente) {
    return 'ficha-cliente.html?cliente=' + encodeURIComponent(refDaCliente(cliente));
  }

  function urlAtendimento(cliente) {
    return 'atendimento.html?cliente=' + encodeURIComponent(refDaCliente(cliente));
  }

  function irPara(url) { window.location.href = url; }

  /** Mensagem de erro amigável vinda do Banco/API. */
  function avisarErro(erro) {
    console.warn('[Lírios]', erro);
    toast(erro && erro.message ? erro.message : 'Não foi possível salvar.');
  }

  /* ------------------------- 5. Tela de clientes -------------------------- */

  function iniciarClientes() {
    var corpo = document.getElementById('clientTableBody');
    if (!corpo) return;

    // Vindo de uma tela que precisa de uma cliente escolhida (ex.: ficha sem cliente indicada).
    if (/[?&]escolha=1/.test(window.location.search)) toast('Escolha uma cliente para abrir a ficha.');

    var input = document.getElementById('clientSearch');
    var estado = { termo: '', status: 'todas' };
    var vazio = estadoVazioDepoisDa(corpo.closest('table'), 'Nenhuma cliente encontrada com esse filtro.');

    function aplicar() {
      var visiveis = 0;

      Array.prototype.forEach.call(corpo.rows, function (linha) {
        var texto = normalizar(linha.textContent);
        var badge = linha.querySelector('.badge');
        var status = badge ? normalizar(badge.textContent) : '';
        var combinaTermo = !estado.termo || texto.indexOf(estado.termo) !== -1;
        var combinaStatus = estado.status === 'todas' ||
          status === estado.status;
        var mostrar = combinaTermo && combinaStatus;
        linha.style.display = mostrar ? '' : 'none';
        if (mostrar) visiveis++;
      });

      if (vazio) vazio.style.display = visiveis ? 'none' : 'block';
    }

    function montarLinha(cliente) {
      var linha = document.createElement('tr');
      linha.dataset.destino = urlFicha(cliente);
      linha.dataset.clienteId = cliente.id;
      linha.innerHTML =
        '<td class="name">' + esc(cliente.nome) + '</td>' +
        '<td>' + esc(cliente.telefone || '—') + '</td>' +
        '<td>' + esc(cliente.email || '—') + '</td>' +
        '<td>' + esc(cliente.servico || '—') + '</td>' +
        '<td><button type="button" class="badge badge-botao ' + classeDoStatus(cliente.status) + '" ' +
        'data-acao="status-cliente" title="Clique para ver detalhes ou mudar o status">' +
        esc(cliente.status || 'Ativa') + '</button></td>' +
        '<td class="row-actions"><button type="button" class="icon-btn" data-acao="acoes-cliente" ' +
        'aria-label="Ações da cliente">⋮</button></td>';

      linha.addEventListener('click', function () { irPara(linha.dataset.destino); });
      ligarAcaoCliente(linha);
      ligarStatusCliente(linha);
      return linha;
    }

    function classeDoStatus(status) {
      return status === 'Pendente' ? 'badge-warn' : (status === 'Inativa' ? 'badge-off' : 'badge-ok');
    }

    // Clicar no status mostra o que está pendente e permite trocar ali mesmo.
    function ligarStatusCliente(linha) {
      var botao = linha.querySelector('[data-acao="status-cliente"]');
      if (!botao) return;

      botao.addEventListener('click', function (evento) {
        evento.stopPropagation();
        var cliente = acharClientePorId(carregarClientes(), linha.dataset.clienteId);
        if (!cliente) return;

        var contratos = Banco.contratos.filter(function (c) {
          return Banco.mesmaCliente(c, cliente) && !c.assinado && c.status === 'Pendente';
        });
        var pendencias = Banco.pendenciasAbertas().filter(function (p) {
          return Banco.mesmaCliente(p, cliente);
        });

        var itens = contratos.map(function (c) { return 'Contrato de ' + c.servico + ' aguardando assinatura'; })
          .concat(pendencias.filter(function (p) { return p.tipo !== 'contrato'; })
            .map(function (p) { return ({ exame: 'Exame', confirmacao: 'Confirmação', anotacao: 'Anotação', pagamento: 'Pagamento', outro: 'Outro' }[p.tipo] || 'Pendência') + ': ' + p.descricao; }));

        var detalhe;
        if (itens.length) {
          detalhe = '<p class="small" style="margin:0 0 6px;"><strong>O que está pendente:</strong></p><ul class="small" style="margin:0 0 14px;padding-left:18px;">' +
            itens.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
        } else if (cliente.status === 'Pendente') {
          detalhe = '<p class="small muted" style="margin:0 0 14px;">Marcada como pendente manualmente. Não há contrato nem pendência aberta no sistema.</p>';
        } else {
          detalhe = '<p class="small muted" style="margin:0 0 14px;">Nada pendente para esta cliente.</p>';
        }

        modalGenerico({
          titulo: cliente.nome,
          subtitulo: 'Status do cadastro',
          html: detalhe + campoHTML({ nome: 'status', label: 'Alterar status', valor: cliente.status || 'Ativa',
                                      opcoes: ['Ativa', 'Pendente', 'Inativa'] }),
          acoes: [
            { rotulo: 'Fechar' },
            {
              rotulo: 'Salvar status', variante: 'primary',
              aoClicar: async function (ctx) {
                var novo = lerCampos(ctx.corpo).status;
                try {
                  await Banco.atualizarCliente(cliente, { status: novo });
                  renderTabela();
                  aplicar();
                  fecharGenerico();
                  toast(cliente.nome + ' agora está como ' + novo.toLowerCase() + '.');
                } catch (erro) {
                  avisarErro(erro);
                }
              }
            }
          ]
        });
      });
    }

    function renderTabela() {
      corpo.innerHTML = '';
      carregarClientes().forEach(function (cliente) {
        corpo.appendChild(montarLinha(cliente));
      });
    }

    // Ligação direta: o stopPropagation da linha impede um handler global de receber o clique.
    function ligarAcaoCliente(linha) {
      var botao = linha.querySelector('[data-acao="acoes-cliente"]');
      if (!botao || botao.dataset.ligado) return;
      botao.dataset.ligado = '1';

      botao.addEventListener('click', function (evento) {
        evento.stopPropagation();

        var lista = carregarClientes();
        var cliente = acharClientePorId(lista, linha.dataset.clienteId);
        if (!cliente) return;

        var pendente = cliente.status === 'Pendente';

        modalGenerico({
          titulo: cliente.nome,
          subtitulo: 'O que você quer fazer com esta cliente?',
          html: '<p class="small muted" style="margin:0 0 4px;">' +
            esc(cliente.servico || 'Serviço não informado') + ' · ' +
            esc(cliente.telefone || 'sem telefone') + '</p>',
          acoes: [
            {
              rotulo: 'Abrir ficha',
              aoClicar: function () { irPara(urlFicha(cliente)); }
            },
            {
              rotulo: 'Editar cadastro',
              aoClicar: function () { fecharGenerico(); formularioCliente(linha); }
            },
            {
              rotulo: pendente ? 'Marcar como ativa' : 'Marcar como pendente',
              variante: 'primary',
              aoClicar: async function () {
                try {
                  await Banco.atualizarCliente(cliente, { status: pendente ? 'Ativa' : 'Pendente' });
                  renderTabela();
                  aplicar();
                  fecharGenerico();
                  toast(cliente.nome + ' marcada como ' + (pendente ? 'ativa' : 'pendente') + '.');
                } catch (erro) {
                  avisarErro(erro);
                }
              }
            },
            {
              rotulo: 'Excluir cliente',
              aoClicar: async function () {
                try {
                  await Banco.removerCliente(cliente);
                  renderTabela();
                  aplicar();
                  fecharGenerico();
                  toast(cliente.nome + ' foi excluída.');
                } catch (erro) {
                  avisarErro(erro);
                }
              }
            }
          ]
        });
      });
    }

    function formularioCliente(linha) {
      var lista = carregarClientes();
      var atual = linha ? acharClientePorId(lista, linha.dataset.clienteId) : null;
      var dadosAtuais = atual || { status: 'Ativa', servico: SERVICOS[0] };

      modalGenerico({
        titulo: atual ? 'Editar cliente' : 'Nova cliente',
        subtitulo: 'Dados básicos do cadastro',
        html: campoHTML({ nome: 'nome', label: 'Nome completo', valor: dadosAtuais.nome, attrs: atributosDoCampo('nome') }) +
          campoHTML({ nome: 'cpf', label: 'CPF', valor: dadosAtuais.cpf, attrs: atributosDoCampo('cpf') }) +
          campoHTML({ nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', valor: dadosAtuais.nascimento, attrs: atributosDoCampo('nascimento') }) +
          campoHTML({ nome: 'telefone', label: 'Telefone', valor: dadosAtuais.telefone, attrs: atributosDoCampo('telefone') }) +
          campoHTML({ nome: 'email', label: 'E-mail', tipo: 'email', valor: dadosAtuais.email, attrs: atributosDoCampo('email') }) +
          campoHTML({ nome: 'servico', label: 'Serviço principal', valor: dadosAtuais.servico, opcoes: nomesDeServico() }) +
          campoHTML({ nome: 'status', label: 'Status', valor: dadosAtuais.status, opcoes: ['Ativa', 'Pendente', 'Inativa'] }),
        acoes: [
          { rotulo: 'Cancelar' },
          {
            rotulo: atual ? 'Salvar' : 'Cadastrar', variante: 'primary',
            aoClicar: async function (ctx) {
              var dados = lerCampos(ctx.corpo);
              if (!dados.nome) { toast('Informe o nome da cliente.'); return; }

              var problema = erroDosDadosDaCliente({ cpf: dados.cpf, telefone: dados.telefone, email: dados.email,
                                                     nascimento: normalizarNascimento(dados.nascimento) });
              if (problema) { toast(problema); return; }

              var registro = {
                nome: dados.nome,
                cpf: dados.cpf ? formatarCpf(dados.cpf) : '',
                nascimento: normalizarNascimento(dados.nascimento),
                telefone: dados.telefone ? formatarTelefone(dados.telefone) : '',
                email: dados.email,
                status: dados.status,
                servico_principal_id: servicoIdPorNome(dados.servico)
              };

              try {
                if (atual) {
                  await Banco.atualizarCliente(atual, registro);
                } else {
                  await Banco.criarCliente(registro);
                }

                renderTabela();
                aplicar();
                fecharGenerico();
                toast(atual
                  ? 'Cadastro de ' + dados.nome + ' atualizado.'
                  : 'Cliente ' + dados.nome + ' cadastrada.');
              } catch (erro) {
                avisarErro(erro);
              }
            }
          }
        ]
      });
    }

    if (input) {
      input.addEventListener('input', function () {
        estado.termo = normalizar(input.value);
        aplicar();
      });
    }

    // Permite chegar da tela de Serviços: clientes.html?servico=Pré-natal
    var parametros = new URLSearchParams(window.location.search);
    var termo = parametros.get('busca') || parametros.get('servico');
    if (termo && input) {
      input.value = termo;
      estado.termo = normalizar(termo);
    }

    var botaoFiltros = document.getElementById('btnFiltros');
    if (botaoFiltros) {
      botaoFiltros.addEventListener('click', function () {
        modalGenerico({
          titulo: 'Filtrar clientes',
          subtitulo: 'Mostre apenas um status por vez',
          html: campoHTML({ nome: 'status', label: 'Status', valor: estado.status, opcoes: ['todas', 'ativa', 'pendente', 'inativa'] }),
          acoes: [
            { rotulo: 'Cancelar' },
            {
              rotulo: 'Aplicar', variante: 'primary',
              aoClicar: function (ctx) {
                estado.status = lerCampos(ctx.corpo).status;
                aplicar();
                fecharGenerico();
                toast('Filtro aplicado: ' + estado.status + '.');
              }
            }
          ]
        });
      });
    }

    var botaoNova = document.getElementById('btnNovaCliente');
    if (botaoNova) botaoNova.addEventListener('click', function () { formularioCliente(null); });

    renderTabela();
    aplicar();
  }

  /* -------------------------------- 6. Serviços --------------------------- */

  function iniciarServicos() {
    var grade = document.getElementById('serviceGrid');
    if (!grade) return;

    var input = document.getElementById('serviceSearch');
    var vazio = document.getElementById('serviceEmpty');

    function filtrar() {
      var termo = input ? input.value.trim().toLowerCase() : '';
      var visiveis = 0;

      Array.prototype.forEach.call(grade.querySelectorAll('.svc-card'), function (card) {
        var titulo = card.querySelector('h3');
        var combina = (titulo ? titulo.textContent : '').toLowerCase().indexOf(termo) !== -1;
        card.style.display = combina ? '' : 'none';
        if (combina) visiveis++;
      });

      if (vazio) vazio.style.display = visiveis ? 'none' : 'block';
    }

    if (input) input.addEventListener('input', filtrar);

    function montarCard(nome, descricao, duracao) {
      var card = document.createElement('div');
      card.className = 'card svc-card';
      card.style.cssText = 'padding:22px 24px; display:flex; flex-direction:column; gap:10px;';
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">' +
        '<h3 style="font-size:19px;">' + esc(nome) + '</h3>' +
        '<span class="badge badge-ok">Ativo</span></div>' +
        '<p class="muted small" style="flex:1;">' + esc(descricao || 'Sem descrição cadastrada.') + '</p>' +
        '<div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding-top:12px;">' +
        '<span class="small muted">Duração: ' + esc(duracao || '60') + ' min</span>' +
        '<span class="small"><b>0</b> clientes</span></div>' +
        '<div style="display:flex; gap:10px;">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-acao="editar-servico">Editar</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-acao="clientes-servico">Ver clientes</button>' +
        '</div>';
      return card;
    }

    function formularioServico(card) {
      var nome = card ? card.querySelector('h3').textContent.trim() : '';
      var descricao = card ? card.querySelector('p.muted').textContent.trim() : '';
      var duracao = '60';
      if (card) {
        var rodape = card.querySelector('span.small.muted');
        var achado = rodape && rodape.textContent.match(/(\d+)/);
        if (achado) duracao = achado[1];
      }

      modalGenerico({
        titulo: card ? 'Editar serviço' : 'Novo serviço',
        subtitulo: 'Dados apresentados na lista de serviços',
        html: campoHTML({ nome: 'nome', label: 'Nome do serviço', valor: nome }) +
          campoHTML({ nome: 'descricao', label: 'Descrição', linha: 3, valor: descricao }) +
          campoHTML({ nome: 'duracao', label: 'Duração (minutos)', tipo: 'number', valor: duracao }),
        acoes: [
          { rotulo: 'Cancelar' },
          {
            rotulo: card ? 'Salvar' : 'Cadastrar', variante: 'primary',
            aoClicar: async function (ctx) {
              var dados = lerCampos(ctx.corpo);
              if (!dados.nome) { toast('Informe o nome do serviço.'); return; }

              try {
                if (card) {
                  var atual = Banco.servicoPorNome(nome);
                  if (atual) await Banco.atualizarServico(atual, dados);

                  card.querySelector('h3').textContent = dados.nome;
                  card.querySelector('p.muted').textContent = dados.descricao || 'Sem descrição cadastrada.';
                  card.querySelector('span.small.muted').textContent = 'Duração: ' + (dados.duracao || '60') + ' min';
                  toast('Serviço ' + dados.nome + ' atualizado.');
                } else {
                  var novo = await Banco.criarServico({
                    nome: dados.nome,
                    descricao: dados.descricao,
                    duracao_min: dados.duracao,
                    valor: 0
                  });
                  grade.appendChild(montarCard(novo.nome, novo.descricao, novo.duracao_min));
                  toast('Serviço ' + dados.nome + ' cadastrado.');
                }

                fecharGenerico();
                filtrar();
              } catch (erro) {
                avisarErro(erro);
              }
            }
          }
        ]
      });
    }

    var botaoNovo = document.getElementById('btnNovoServico');
    if (botaoNovo) botaoNovo.addEventListener('click', function () { formularioServico(null); });

    // Ações dos cards (delegação: vale para cards criados depois)
    document.addEventListener('click', function (evento) {
      var alvo = evento.target.closest('[data-acao="editar-servico"], [data-acao="clientes-servico"]');
      if (!alvo) return;
      var card = alvo.closest('.svc-card');
      if (!card) return;
      var nome = card.querySelector('h3').textContent.trim();

      if (alvo.dataset.acao === 'editar-servico') {
        formularioServico(card);
      } else {
        window.location.href = 'clientes.html?servico=' + encodeURIComponent(nome);
      }
    });
  }

  /* ---------------------------------- 7. Abas ----------------------------- */

  function attachTabs(navSelector, panelSelector) {
    var abas = Array.prototype.slice.call(document.querySelectorAll(navSelector));
    var paineis = Array.prototype.slice.call(document.querySelectorAll(panelSelector));
    if (!abas.length || !paineis.length) return;

    function ativar(id) {
      abas.forEach(function (aba) {
        var ativa = aba.dataset.tab === id;
        aba.classList.toggle('active', ativa);
        aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
      });
      paineis.forEach(function (painel) {
        painel.classList.toggle('active', painel.dataset.panel === id);
      });
    }

    abas.forEach(function (aba) {
      aba.setAttribute('role', 'tab');
      aba.addEventListener('click', function () { ativar(aba.dataset.tab); });
    });

    var inicial = abas.filter(function (a) { return a.classList.contains('active'); })[0] || abas[0];
    if (inicial && inicial.dataset.tab) ativar(inicial.dataset.tab);
  }

  /* --------------------------- 8. Resumo inteligente ---------------------- */

  function lerLinhas(el) {
    var bruto = el.getAttribute('data-ai-lines') || '[]';
    try {
      var linhas = JSON.parse(bruto);
      return Array.isArray(linhas) ? linhas.map(String) : [];
    } catch (erro) {
      console.warn('[Lírios] data-ai-lines inválido em', el, erro);
      return [];
    }
  }

  function attachAISummary(buttonEl, outputEl, summaryLines, gerador) {
    if (!buttonEl || !outputEl) return;
    var textoOriginal = buttonEl.textContent;

    function mostrar(linhas, aviso) {
      var fragmento = document.createDocumentFragment();
      linhas.forEach(function (linha) {
        var item = document.createElement('li');
        item.textContent = linha;
        fragmento.appendChild(item);
      });
      if (aviso) {
        var nota = document.createElement('li');
        nota.className = 'muted small';
        nota.textContent = aviso;
        fragmento.appendChild(nota);
      }
      outputEl.textContent = '';
      outputEl.appendChild(fragmento);
    }

    function terminar() {
      outputEl.removeAttribute('aria-busy');
      buttonEl.textContent = textoOriginal;
      buttonEl.disabled = false;
    }

    buttonEl.addEventListener('click', function () {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Gerando resumo...';
      outputEl.textContent = '';
      outputEl.setAttribute('aria-busy', 'true');

      // Com API e uma cliente identificada: resumo real. Senão, a simulação de antes.
      var pedido = gerador ? Promise.resolve(gerador()) : Promise.resolve(null);

      pedido.then(function (resultado) {
        if (resultado && resultado.linhas && resultado.linhas.length) {
          mostrar(resultado.linhas, resultado.aviso);
          terminar();
        } else {
          window.setTimeout(function () { mostrar(summaryLines); terminar(); }, 900);
        }
      }).catch(function (erro) {
        console.warn('[Lírios] resumo por IA indisponível', erro);
        mostrar(summaryLines, 'Não foi possível gerar o resumo agora. Exibindo exemplo.');
        terminar();
      });
    });
  }

  /** Cliente indicada em ?cliente= (usada pelos resumos da Ficha e do Atendimento). */
  function clienteDaPagina() {
    return clienteDaUrl(carregarClientes()).cliente;
  }

  /** Liga os botões de resumo. Pode ser chamada de novo após re-renderizar um painel. */
  function iniciarResumos() {
    Array.prototype.slice.call(document.querySelectorAll('[data-ai-summary]')).forEach(function (botao) {
      if (botao.dataset.ligado) return;
      botao.dataset.ligado = '1';
      var saida = botao.getAttribute('data-ai-summary');
      // Ficha e Atendimento resumem UMA cliente; Dashboard e Relatórios continuam como exemplo.
      var porCliente = saida === 'fichaAiOutput' || saida === 'atendAiOutput';
      var gerador = porCliente ? function () { return Banco.gerarResumoIA(clienteDaPagina()); } : null;
      attachAISummary(botao, document.getElementById(saida), lerLinhas(botao), gerador);
    });
  }

  /** Cópia do resumo (ligada uma única vez por página). */
  function iniciarCopiar() {
    document.addEventListener('click', function (evento) {
      var botao = evento.target.closest('[data-copiar]');
      if (!botao) return;
      var saida = document.getElementById(botao.dataset.copiar);
      var texto = saida
        ? Array.prototype.map.call(saida.querySelectorAll('li'), function (li) { return li.textContent; }).join('\n')
        : '';

      if (!texto) {
        toast('Gere o resumo antes de copiar.');
        return;
      }

      copiarTexto(texto)
        .then(function () { toast('Resumo copiado para a área de transferência.'); })
        .catch(function () { toast('Não foi possível copiar automaticamente.'); });
    });
  }

  /* ---------------------------- 9. Ficha da cliente ----------------------- */

  function iniciarFicha() {
    var painelDados = document.querySelector('.tab-panel[data-panel="dados"]');
    if (!painelDados) return;

    var botao = document.getElementById('btnEditarFicha');
    var blocos = Array.prototype.slice.call(painelDados.querySelectorAll('.grid > div'));

    // Ordem dos campos exibidos na aba Dados Gerais.
    var CHAVES = ['nome', 'cpf', 'nascimento', 'telefone', 'email', 'cidade', 'servico'];

    var lista = carregarClientes();
    var consulta = clienteDaUrl(lista);
    var cliente = consulta.cliente;

    // Menu "Gestantes" (sem cliente no link): abre a primeira gestante, ou o primeiro cadastro.
    if (!cliente && !consulta.pedido) {
      cliente = lista.filter(function (c) { return c.gestacao; })[0] || lista[0] || null;
      if (cliente) window.history.replaceState(null, '', urlFicha(cliente));
    }

    // Link com cliente que não existe: nunca abre outra no lugar. Volta para a lista.
    if (!cliente) { irPara('clientes.html?escolha=1'); return; }

    /** Diferença em dias entre hoje e uma data ISO (negativa = já passou). */
    function diasAte(iso) {
      if (!iso) return null;
      var hoje = fromISODate(hojeISO());
      var dias = Math.round((fromISODate(iso) - hoje) / 86400000);
      return isNaN(dias) ? null : dias;
    }

    /** Idade gestacional a partir da DUM, em semanas e dias. */
    function idadeGestacional(dum) {
      if (!dum) return '—';
      var dias = Math.round((fromISODate(hojeISO()) - fromISODate(dum)) / 86400000);
      if (isNaN(dias) || dias < 0) return '—';
      var semanas = Math.floor(dias / 7);
      var resto = dias % 7;
      return semanas + (semanas === 1 ? ' semana' : ' semanas') +
        (resto ? ' e ' + resto + (resto === 1 ? ' dia' : ' dias') : '');
    }

    function renderizarGestacao() {
      var painel = document.querySelector('.tab-panel[data-panel="gestacao"]');
      if (!painel) return;

      var g = cliente.gestacao;

      // Sem dados: oferece o cadastro em vez de um texto morto.
      if (!g) {
        painel.innerHTML =
          '<p class="muted" style="margin:0 0 16px;">' +
          'Nenhuma gestação em acompanhamento registrada para esta cliente.</p>' +
          '<button type="button" class="btn btn-primary btn-sm" data-acao="editar-gestacao">' +
          'Registrar dados da gestação</button>';
        return;
      }

      var ig = idadeGestacional(g.dum);
      var dias = diasAte(g.dpp);
      var contagem = dias === null ? '—'
        : (dias >= 0 ? dias + ' dias' : 'data prevista já passou');

      var resumo = [
        'Gestação de ' + ig + ' em acompanhamento',
        'Parto previsto para ' + (g.dpp ? formatarBR(g.dpp) : '—') +
          (dias !== null && dias >= 0 ? ' (em ' + dias + ' dias)' : ''),
        'Bebê: ' + (g.bebe || 'nome não informado') + ' · ' + (g.sexo || 'sexo não informado')
      ];

      var iconeIa =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2' +
        'M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4.5"/></svg>';

      painel.innerHTML =
        '<div class="grid" style="grid-template-columns:1fr 1fr; margin-bottom:18px;">' +
          '<div>' +
            '<p class="field-label">Data da última menstruação</p>' +
            '<p>' + esc(g.dum ? formatarBR(g.dum) : '—') + '</p>' +
            '<p class="field-label" style="margin-top:14px;">Data prevista do parto</p>' +
            '<p>' + esc(g.dpp ? formatarBR(g.dpp) : '—') + '</p>' +
            '<p class="field-label" style="margin-top:14px;">Idade gestacional</p>' +
            '<p>' + esc(ig) + '</p>' +
            '<p class="field-label" style="margin-top:14px;">Tipo de parto desejado</p>' +
            '<p>' + esc(g.parto || 'A definir') + '</p>' +
          '</div>' +
          '<div>' +
            '<p class="field-label">Informações do bebê</p>' +
            '<div class="baby-card">' +
              '<div>' +
                '<p><b>Nome:</b> ' + esc(g.bebe || '—') + '</p>' +
                '<p><b>Sexo:</b> ' + esc(g.sexo || '—') + '</p>' +
                '<p><b>Movimentações:</b> ' + esc(g.mov || '—') + '</p>' +
              '</div>' +
              '<div class="baby-count">' +
                '<span class="small muted">Parto previsto em</span>' +
                '<b>' + esc(contagem) + '</b>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<p class="field-label">Observações</p>' +
        '<p>' + esc(g.obs || 'Nenhuma observação registrada.') + '</p>' +
        '<div style="display:flex; gap:10px; margin-top:18px;">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-acao="editar-gestacao">' +
          'Editar dados da gestação</button>' +
        '</div>' +
        '<div class="ai-box" style="margin-top:20px;">' +
          '<div class="ai-box-head">' + iconeIa + ' Resumo inteligente</div>' +
          '<ul id="fichaAiOutput" class="ai-list">' +
            resumo.map(function (linha) { return '<li>' + esc(linha) + '</li>'; }).join('') +
          '</ul>' +
          '<div style="display:flex; gap:10px;">' +
            '<button type="button" class="btn btn-primary btn-sm" data-ai-summary="fichaAiOutput"' +
            ' data-ai-lines=\'' + esc(JSON.stringify(resumo)) + '\'>Gerar resumo</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copiar="fichaAiOutput">Copiar</button>' +
          '</div>' +
        '</div>';

      iniciarResumos();
    }

    function abrirGestacao() {
      var g = cliente.gestacao || {};

      var ctx = modalGenerico({
        titulo: 'Dados da gestação',
        subtitulo: cliente.nome + ' · a data prevista do parto é calculada a partir da DUM',
        html: campoHTML({ nome: 'dum', label: 'Data da última menstruação (DUM)', tipo: 'date', valor: g.dum }) +
          campoHTML({ nome: 'dpp', label: 'Data prevista do parto', tipo: 'date', valor: g.dpp }) +
          campoHTML({ nome: 'parto', label: 'Tipo de parto desejado', valor: g.parto || 'A definir', opcoes: ['Normal', 'Cesárea', 'A definir'] }) +
          campoHTML({ nome: 'bebe', label: 'Nome do bebê', valor: g.bebe }) +
          campoHTML({ nome: 'sexo', label: 'Sexo do bebê', valor: g.sexo || 'Ainda não sabe', opcoes: ['Feminino', 'Masculino', 'Ainda não sabe'] }) +
          campoHTML({ nome: 'mov', label: 'Movimentações', valor: g.mov || 'Ativas', opcoes: ['Ativas', 'Pouco ativas', 'Ainda não sente'] }) +
          campoHTML({ nome: 'obs', label: 'Observações', linha: 3, valor: g.obs }),
        acoes: [
          { rotulo: 'Cancelar' },
          {
            rotulo: 'Salvar', variante: 'primary',
            aoClicar: async function (c) {
              var dados = lerCampos(c.corpo);
              if (!dados.dum) { toast('Informe a data da última menstruação.'); return; }

              try {
                await Banco.salvarGestacao(cliente, {
                  id: g.id,
                  dum: dados.dum,
                  parto: dados.parto,
                  bebe: dados.bebe,
                  sexo: dados.sexo,
                  mov: dados.mov,
                  obs: dados.obs
                });

                renderizarFicha();
                fecharGenerico();
                toast('Dados da gestação de ' + cliente.nome + ' salvos.');
              } catch (erro) {
                avisarErro(erro);
              }
            }
          }
        ]
      });

      // Mudar a DUM recalcula a data prevista do parto (DUM + 280 dias).
      if (ctx) {
        var campoDum = ctx.corpo.querySelector('[data-campo="dum"]');
        var campoDpp = ctx.corpo.querySelector('[data-campo="dpp"]');
        if (campoDum && campoDpp) {
          campoDum.addEventListener('change', function () {
            if (!campoDum.value) return;
            var prevista = fromISODate(campoDum.value);
            prevista.setDate(prevista.getDate() + 280);
            campoDpp.value = toISODate(prevista);
          });
        }
      }
    }

    function registrosDoCliente() {
      return Banco.atendimentosDoCliente(cliente);
    }

    /** 'DD/MM/AAAA' -> 'DD/MM'. */
    function rotuloData(data) {
      var texto = String(data || '');
      var iso = texto.slice(0, 10).split('-');
      if (iso.length === 3) return iso[2] + '/' + iso[1];

      var br = texto.split('/');
      return br.length === 3 ? br[0] + '/' + br[1] : (texto || '—');
    }

    function renderizarAtendimentos() {
      var painel = document.querySelector('.tab-panel[data-panel="atendimentos"]');
      if (!painel) return;

      var registros = registrosDoCliente();

      var lista = registros.length
        ? '<div class="agenda-list">' + registros.map(function (registro) {
            return '<div class="agenda-item">' +
              '<span class="time">' + esc(rotuloData(registro.data)) + '</span>' +
              '<span class="who">' + esc(registro.servico || 'Atendimento') + '</span>' +
              '<span class="what muted">' + esc(registro.profissional || '') + '</span>' +
              '<button type="button" class="icon-btn" data-acao="ver-atendimento" data-id="' +
              esc(registro.id) + '" aria-label="Ver atendimento">⋮</button>' +
              '</div>';
          }).join('') + '</div>'
        : '<p class="muted" style="margin:0;">Nenhum atendimento registrado para esta cliente.</p>';

      painel.innerHTML = lista +
        '<a class="btn btn-primary btn-sm" style="margin-top:18px;" href="' +
        urlAtendimento(cliente) + '">+ Novo atendimento</a>';
    }

    function renderizarExames() {
      var painel = document.querySelector('.tab-panel[data-panel="exames"]');
      if (!painel) return;

      var exames = Banco.examesDoCliente(cliente);

      painel.innerHTML = exames.length
        ? '<div class="agenda-list">' + exames.map(function (exame) {
            return '<div class="agenda-item">' +
              '<span class="time">' + esc(rotuloData(exame.data)) + '</span>' +
              '<span class="who">' + esc(exame.nome) + '</span>' +
              '<span class="what muted">Solicitado no atendimento</span>' +
              '</div>';
          }).join('') + '</div>'
        : '<p class="muted" style="margin:0;">Nenhum exame registrado para esta cliente.</p>';
    }

    function renderizarContratos() {
      var painel = document.querySelector('.tab-panel[data-panel="contratos"]');
      if (!painel) return;

      var contratos = Banco.contratos.filter(function (registro) {
        return Banco.mesmaCliente(registro, cliente);
      });

      painel.innerHTML = contratos.length
        ? '<div class="agenda-list">' + contratos.map(function (registro) {
            return '<div class="agenda-item">' +
              '<span class="time">' + esc(registro.servico) + '</span>' +
              '<span class="who">Contrato de acompanhamento</span>' +
              '<span class="badge ' + (registro.assinado ? 'badge-ok' : 'badge-warn') + '">' +
              (registro.assinado ? 'Assinado' : 'Pendente') + '</span>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-acao="contrato-cliente"' +
              ' data-contrato-id="' + esc(registro.id) + '" data-servico="' + esc(registro.servico) + '">' +
              (registro.assinado ? 'Ver contrato' : 'Assinar contrato') + '</button>' +
              '</div>';
          }).join('') + '</div>'
        : '<p class="muted" style="margin:0;">Nenhum contrato registrado para esta cliente.</p>';
    }

    function formatarTamanho(bytes) {
      if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
      return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    /** Aba Documentos: lista os arquivos da cliente e permite anexar novos. */
    async function renderizarDocumentos() {
      var painel = document.querySelector('.tab-panel[data-panel="documentos"]');
      if (!painel) return;

      var lista = [];
      var problemaLista = '';
      try {
        lista = await Banco.listarDocumentos(cliente.id);
      } catch (erro) {
        // O botão de anexar continua aparecendo; a tela mostra o motivo em vez de esconder tudo.
        console.warn('[Lírios] documentos:', erro);
        problemaLista = (erro && erro.message) ? erro.message : 'erro desconhecido';
      }

      painel.innerHTML =
        '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">' +
          '<span class="small muted" style="margin-right:auto;align-self:center;">Aceita PDF, imagens (PNG, JPG), Word e TXT, até 5 MB.</span>' +
          '<button type="button" class="btn btn-primary btn-sm" id="btnAdicionarDocumento">+ Adicionar documento</button>' +
          '<input type="file" id="arquivoDocumento" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx">' +
        '</div>' +
        (problemaLista
          ? '<p class="small" style="margin:0 0 10px;color:#8f2d2d;">Não foi possível carregar a lista de documentos (' + esc(problemaLista) +
            '). Se o banco foi criado antes desta função, rode o script <b>db/migracao_documentos.sql</b> no MySQL e reinicie a API.</p>'
          : '') +
        (lista.length
          ? '<div class="agenda-list">' + lista.map(function (doc) {
              return '<div class="agenda-item">' +
                '<span class="time">' + esc(String(doc.criado_em || '').slice(0, 10).split('-').reverse().join('/')) + '</span>' +
                '<span class="who">' + esc(doc.nome) + '</span>' +
                '<span class="what muted">' + esc(formatarTamanho(doc.tamanho)) + '</span>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-doc-abrir="' + doc.id + '">Abrir</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-doc-excluir="' + doc.id + '">Excluir</button>' +
                '</div>';
            }).join('') + '</div>'
          : (problemaLista ? '' : '<p class="muted" style="margin:0;">Nenhum documento anexado ainda.</p>'));

      var entrada = document.getElementById('arquivoDocumento');
      document.getElementById('btnAdicionarDocumento').addEventListener('click', function () { entrada.click(); });

      entrada.addEventListener('change', async function () {
        var arquivo = entrada.files && entrada.files[0];
        if (!arquivo) return;
        try {
          await Banco.adicionarDocumento(cliente.id, arquivo);
          toast('Documento "' + arquivo.name + '" anexado.');
          renderizarDocumentos();
        } catch (erro) {
          avisarErro(erro);
          entrada.value = '';
        }
      });

      Array.prototype.forEach.call(painel.querySelectorAll('[data-doc-abrir]'), function (botao) {
        botao.addEventListener('click', async function () {
          var doc = lista.filter(function (d) { return String(d.id) === botao.dataset.docAbrir; })[0];
          try { await Banco.abrirDocumento(doc); } catch (erro) { avisarErro(erro); }
        });
      });

      Array.prototype.forEach.call(painel.querySelectorAll('[data-doc-excluir]'), function (botao) {
        botao.addEventListener('click', function () {
          var doc = lista.filter(function (d) { return String(d.id) === botao.dataset.docExcluir; })[0];
          modalGenerico({
            titulo: 'Excluir documento',
            subtitulo: doc.nome,
            html: '<p>Este arquivo será removido da ficha. Essa ação não pode ser desfeita.</p>',
            acoes: [
              { rotulo: 'Cancelar' },
              {
                rotulo: 'Excluir', variante: 'primary',
                aoClicar: async function () {
                  try { await Banco.removerDocumento(doc.id); } catch (erro) { avisarErro(erro); return; }
                  fecharGenerico();
                  toast('Documento excluído.');
                  renderizarDocumentos();
                }
              }
            ]
          });
        });
      });
    }

    function abrirDetalhesAtendimento(id) {
      var registro = null;
      Banco.atendimentos.forEach(function (item) {
        if (String(item.id) === String(id)) registro = item;
      });
      if (!registro) return;

      var exames = registro.exames || [];
      var bebe = [];
      if (registro.bpm) bebe.push(registro.bpm + ' bpm');
      if (registro.movimentacoes) bebe.push(registro.movimentacoes);

      var html =
        '<dl class="cal-detail">' +
          '<dt>Data</dt><dd>' + esc(registro.data || '—') + '</dd>' +
          '<dt>Serviço</dt><dd>' + esc(registro.servico || '—') + '</dd>' +
          '<dt>Profissional</dt><dd>' + esc(registro.profissional || '—') + '</dd>' +
          '<dt>Bebê</dt><dd>' + esc(bebe.length ? bebe.join(' · ') : '—') + '</dd>' +
          '<dt>Exames</dt><dd>' + esc(exames.length ? exames.join(', ') : 'Nenhum') + '</dd>' +
        '</dl>' +
        '<p class="field-label">Anotações</p>' +
        '<p>' + esc(registro.anotacoes || 'Sem anotações registradas.') + '</p>' +
        (registro.emocional
          ? '<p class="field-label" style="margin-top:14px;">Estado emocional</p><p>' + esc(registro.emocional) + '</p>'
          : '');

      modalGenerico({
        titulo: 'Atendimento de ' + (registro.data || ''),
        subtitulo: registro.servico || '',
        html: html,
        acoes: [{ rotulo: 'Fechar' }]
      });
    }

    /** Substitui o texto de um item da lista de contato, preservando o ícone. */
    function definirInfo(li, texto) {
      if (!li) return;
      Array.prototype.slice.call(li.childNodes).forEach(function (no) {
        if (no.nodeType === 3 && no.textContent.trim()) li.removeChild(no);
      });
      var span = li.querySelector('span');
      if (!span) {
        span = document.createElement('span');
        li.appendChild(span);
      }
      span.textContent = texto;
    }

    function renderizarFicha() {
      document.title = cliente.nome + ' · Ficha da cliente';

      var titulo = document.querySelector('.ficha-side h3');
      if (titulo) titulo.textContent = cliente.nome;

      var avatar = document.querySelector('.ficha-side .avatar');
      if (avatar) avatar.textContent = iniciais(cliente.nome);

      var badge = document.querySelector('.ficha-side .badge');
      if (badge) {
        badge.textContent = cliente.gestacao ? 'Gestante' : (cliente.status || 'Ativa');
        badge.className = 'badge ' + (cliente.status === 'Pendente' ? 'badge-warn' : (cliente.status === 'Inativa' ? 'badge-off' : 'badge-ok'));
      }

      // Coluna esquerda (lista de contato)
      var infos = document.querySelectorAll('.ficha-info li');
      definirInfo(infos[0], cliente.telefone || '—');
      definirInfo(infos[1], cliente.email || '—');
      var idade = idadeDe(cliente.nascimento);
      definirInfo(infos[2], cliente.nascimento
        ? nascimentoBR(cliente.nascimento) + (idade ? ' (' + idade + ')' : '')
        : '—');
      definirInfo(infos[3], cliente.cidade || '—');

      // Painel da direita (aba Dados Gerais)
      var valores = [
        cliente.nome, cliente.cpf,
        cliente.nascimento ? nascimentoBR(cliente.nascimento) : '—',
        cliente.telefone, cliente.email, cliente.cidade, cliente.servico
      ];
      blocos.forEach(function (div, indice) {
        var alvo = div.querySelector('p:not(.field-label)');
        if (alvo) alvo.textContent = valores[indice] || '—';
      });

      // Todas as abas de histórico são renderizadas a partir dos dados gravados.
      renderizarGestacao();
      renderizarAtendimentos();
      renderizarExames();
      renderizarContratos();
      renderizarDocumentos();

      try {
        var url = urlFicha(cliente);
        if (window.location.search !== '?cliente=' + encodeURIComponent(cliente.id)) {
          window.history.replaceState({}, '', url);
        }
      } catch (erro) { /* histórico indisponível: segue sem atualizar a URL */ }
    }

    renderizarFicha();

    document.addEventListener('click', function (evento) {
      if (evento.target.closest('[data-acao="editar-gestacao"]')) {
        abrirGestacao();
        return;
      }
      var ver = evento.target.closest('[data-acao="ver-atendimento"]');
      if (ver) {
        abrirDetalhesAtendimento(ver.dataset.id);
        return;
      }

      var contrato = evento.target.closest('[data-acao="contrato-cliente"]');
      if (contrato) {
        var servico = contrato.dataset.servico;
        var registro = null;

        carregarContratos().forEach(function (item) {
          if (String(item.id) === String(contrato.dataset.contratoId)) registro = item;
        });

        abrirMinuta(cliente.nome, servico, registro ? registro.assinado : false, renderizarContratos, registro);
      }
    });

    if (!botao) return;

    botao.addEventListener('click', function () {
      var campos = blocos.map(function (div, indice) {
        var rotulo = div.querySelector('.field-label');
        var valor = div.querySelector('p:not(.field-label)');
        var campo = {
          nome: 'c' + indice,
          label: rotulo ? rotulo.textContent.trim() : 'Campo ' + (indice + 1),
          valor: valor ? valor.textContent.trim() : ''
        };

        // Data usa o seletor nativo, com o valor em ISO.
        if (CHAVES[indice] === 'nascimento') {
          campo.valor = cliente.nascimento || '';
          campo.tipo = 'date';
        }
        campo.attrs = atributosDoCampo(CHAVES[indice]);

        return campo;
      });

      modalGenerico({
        titulo: 'Editar dados da cliente',
        subtitulo: 'As alterações são salvas no navegador',
        html: campos.map(campoHTML).join(''),
        acoes: [
          { rotulo: 'Cancelar' },
          {
            rotulo: 'Salvar', variante: 'primary',
            aoClicar: async function (ctx) {
              var valores = lerCampos(ctx.corpo);
              if (!valores['c0']) { toast('Informe o nome da cliente.'); return; }

              var dadosParaConferir = {};
              CHAVES.forEach(function (chave, indice) { dadosParaConferir[chave] = valores['c' + indice]; });
              dadosParaConferir.nascimento = normalizarNascimento(dadosParaConferir.nascimento);
              var problemaFicha = erroDosDadosDaCliente(dadosParaConferir);
              if (problemaFicha) { toast(problemaFicha); return; }

              var mudancas = {};
              var servicoDigitado = null;

              CHAVES.forEach(function (chave, indice) {
                var valor = valores['c' + indice];
                if (chave === 'nascimento') mudancas.nascimento = normalizarNascimento(valor);
                else if (chave === 'servico') servicoDigitado = valor;
                else if (chave === 'cpf') mudancas.cpf = valor ? formatarCpf(valor) : '';
                else if (chave === 'telefone') mudancas.telefone = valor ? formatarTelefone(valor) : '';
                else mudancas[chave] = valor || '';
              });

              var servicoId = servicoIdPorNome(servicoDigitado);
              if (servicoId) mudancas.servico_principal_id = servicoId;

              try {
                await Banco.atualizarCliente(cliente, mudancas);
              } catch (erro) {
                avisarErro(erro);
                return;
              }

              renderizarFicha();
              fecharGenerico();
              toast('Dados da cliente atualizados.');
            }
          }
        ]
      });
    });
  }

  /* ------------------------------ 10. Atendimento ------------------------- */

  function iniciarAtendimento() {
    var chipRow = document.querySelector('.main .chip-row');
    if (!chipRow) return;

    // O atendimento é da cliente indicada em ?cliente=. Sem ela, nunca registra em outra por engano.
    var lista = carregarClientes();
    var cliente = clienteDaUrl(lista).cliente;
    if (!cliente) { irPara('clientes.html?escolha=1'); return; }

    var destinoFicha = urlFicha(cliente);

    function definirResumo(coluna, texto) {
      if (!coluna) return;
      var alvo = coluna.querySelector('p:not(.field-label)');
      if (alvo) alvo.textContent = texto;
    }

    var resumo = document.querySelector('.main .card > .grid');
    if (resumo && cliente) {
      definirResumo(resumo.children[0], cliente.nome);
      definirResumo(resumo.children[1], cliente.servico || '—');
      definirResumo(resumo.children[2], formatarBR(hojeISO()));
      definirResumo(resumo.children[3], 'Dra. Katlhen Carvalho');
    }

    var voltar = document.querySelector('.main .back-link');
    if (voltar) voltar.setAttribute('href', destinoFicha);

    function exames() {
      return Array.prototype.map.call(chipRow.querySelectorAll('.chip'), function (chip) {
        return chip.textContent.replace('×', '').trim();
      });
    }

    function adicionarChip(nome) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = esc(nome) + ' <button type="button" aria-label="remover exame" data-acao="remover-exame">×</button>';
      chipRow.appendChild(chip);
    }

    var botaoAdicionar = document.getElementById('btnAdicionarExame');
    if (botaoAdicionar) {
      botaoAdicionar.addEventListener('click', function () {
        modalGenerico({
          titulo: 'Adicionar exame',
          subtitulo: 'Exame solicitado neste atendimento',
          html: campoHTML({ nome: 'exame', label: 'Nome do exame' }),
          acoes: [
            { rotulo: 'Cancelar' },
            {
              rotulo: 'Adicionar', variante: 'primary',
              aoClicar: function (ctx) {
                var dados = lerCampos(ctx.corpo);
                if (!dados.exame) { toast('Informe o nome do exame.'); return; }
                adicionarChip(dados.exame);
                fecharGenerico();
                toast('Exame "' + dados.exame + '" adicionado.');
              }
            }
          ]
        });
      });
    }

    document.addEventListener('click', function (evento) {
      var remover = evento.target.closest('[data-acao="remover-exame"]');
      if (!remover) return;
      var chip = remover.closest('.chip');
      if (chip) chip.remove();
    });

    function resumoDoAtendimento() {
      var bloco = document.querySelector('.main .card > .grid');
      var dados = {};
      if (!bloco) return dados;
      Array.prototype.forEach.call(bloco.children, function (div) {
        var rotulo = div.querySelector('.field-label');
        var valor = div.querySelector('p:not(.field-label)');
        if (rotulo && valor) dados[rotulo.textContent.trim()] = valor.textContent.trim();
      });
      return dados;
    }

    var botaoSalvar = document.getElementById('btnSalvarAtendimento');
    if (botaoSalvar) {
      botaoSalvar.addEventListener('click', async function () {
        var anotacoes = document.getElementById('atendAnotacoes');
        if (anotacoes && !anotacoes.value.trim()) {
          toast('Descreva o atendimento antes de salvar.');
          anotacoes.focus();
          return;
        }

        var base = resumoDoAtendimento();
        botaoSalvar.disabled = true;          // evita registro duplicado em clique duplo

        try {
          await Banco.criarAtendimento({
            cliente_id: cliente ? cliente.id : null,
            cliente: base.Cliente || (cliente ? cliente.nome : ''),
            servico: base.Serviço || (cliente ? cliente.servico : ''),
            servico_id: servicoIdPorNome(base.Serviço || (cliente ? cliente.servico : '')),
            data: normalizarNascimento(base['Data do atendimento'] || ''),
            profissional: base.Profissional || '',
            anotacoes: anotacoes ? anotacoes.value.trim() : '',
            bpm: (document.getElementById('atendBpm') || {}).value || '',
            movimentacoes: (document.getElementById('atendMov') || {}).value || '',
            emocional: (document.getElementById('atendEmocional') || {}).value || '',
            exames: exames()
          });

          toast('Atendimento de ' + (base.Cliente || '') + ' salvo.');
          window.setTimeout(function () { irPara(destinoFicha); }, 700);
        } catch (erro) {
          botaoSalvar.disabled = false;
          avisarErro(erro);
        }
      });
    }

    var botaoCancelar = document.getElementById('btnCancelarAtendimento');
    if (botaoCancelar) {
      botaoCancelar.addEventListener('click', function () { irPara(destinoFicha); });
    }
  }

  /* ------------------------------- 11. Contratos -------------------------- */

  var CLAUSULAS = [
    'Pelo presente instrumento particular, o INSTITUTO LÍRIOS, representado pela Dra. Katlhen Carvalho, ' +
      'e a cliente {nome} ajustam a prestação do serviço de {servico}.',
    'A prestação ocorre em consultas previamente agendadas, conforme a disponibilidade da agenda do Instituto.',
    'O acompanhamento inclui registro dos atendimentos, orientações e solicitação de exames quando indicado.',
    'Este documento é uma minuta de demonstração, criada para a interface do sistema, e não possui valor jurídico.'
  ];

  /** Abre a minuta do contrato. `aoAssinar` roda depois de gravar a assinatura. */
  function abrirMinuta(nome, servico, assinado, aoAssinar, contrato) {
    var corpo = CLAUSULAS.map(function (paragrafo) {
      return '<p class="small" style="margin:0 0 10px;">' + esc(
        paragrafo.replace('{nome}', nome).replace('{servico}', servico)
      ) + '</p>';
    }).join('') +
      '<p class="small muted" style="margin:14px 0 0;">Status atual: <b>' +
      (assinado ? 'Assinado' : 'Pendente de assinatura') + '</b></p>';

    var acoes = [{ rotulo: 'Fechar' }];

    if (!assinado) {
      acoes.push({
        rotulo: 'Marcar como assinado', variante: 'primary',
        aoClicar: async function () {
          try {
            await marcarContratoAssinado(nome, servico, contrato);
            fecharGenerico();
            if (typeof aoAssinar === 'function') aoAssinar();
            toast('Contrato de ' + nome + ' marcado como assinado.');
          } catch (erro) {
            avisarErro(erro);
          }
        }
      });
    }

    modalGenerico({
      titulo: 'Contrato — ' + nome,
      subtitulo: servico,
      html: corpo,
      acoes: acoes
    });
  }

  function abrirContrato(linha) {
    // O contrato é identificado pelo id da linha (nome + serviço podem se repetir entre clientes).
    var contrato = Banco.contratos.filter(function (c) { return String(c.id) === String(linha.dataset.contratoId); })[0];
    var cliente = contrato ? contrato.cliente : linha.cells[0].textContent.trim();
    var servico = contrato ? contrato.servico : linha.cells[1].textContent.trim();
    var badge = linha.querySelector('.badge');
    var assinado = contrato ? !!contrato.assinado : (badge && normalizar(badge.textContent) === 'assinado');

    abrirMinuta(cliente, servico, assinado, function () {
      aplicarStatusContrato(linha, true);
      sincronizarTotaisContratos();
    }, contrato);
  }

  function aplicarStatusContrato(linha, assinado) {
    var badge = linha.querySelector('.badge');
    if (badge) {
      badge.textContent = assinado ? 'Assinado' : 'Pendente';
      badge.className = 'badge ' + (assinado ? 'badge-ok' : 'badge-warn');
    }
    var link = linha.querySelector('a.small');
    if (link) link.textContent = assinado ? 'Ver contrato' : 'Assinar contrato';
  }

  function acharContrato(nome, servico) {
    var alvo = null;
    Banco.contratos.forEach(function (contrato) {
      if (normalizar(contrato.cliente) === normalizar(nome) &&
          normalizar(contrato.servico) === normalizar(servico)) alvo = contrato;
    });
    return alvo;
  }

  /** Assina o contrato no banco (ou cria o registro, se ainda não existir). */
  async function marcarContratoAssinado(nome, servico, contratoConhecido) {
    // Com o contrato em mãos (id), não procura por nome: evita assinar o de uma homônima.
    var contrato = contratoConhecido || acharContrato(nome, servico);

    if (contrato) {
      await Banco.assinarContrato(contrato);
      return contrato;
    }

    var cliente = acharClientePorNome(Banco.clientes, nome);
    var servicoBanco = Banco.servicoPorNome(servico);

    if (cliente && servicoBanco) {
      contrato = await Banco.criarContrato({
        cliente_id: cliente.id,
        cliente: cliente.nome,
        servico_id: servicoBanco.id,
        servico: servicoBanco.nome,
        valor: servicoBanco.valor
      });
      await Banco.assinarContrato(contrato);
    }

    return contrato;
  }

  /** Totais do topo derivados da própria tabela (sem números soltos). */
  function sincronizarTotaisContratos() {
    var linhas = Array.prototype.slice.call(
      document.querySelectorAll('.main .table-card table tbody tr')
    );
    var cartoes = document.querySelectorAll('.main .card h2');
    if (!linhas.length || cartoes.length < 3) return;

    var assinados = linhas.filter(function (linha) {
      var badge = linha.querySelector('.badge');
      return badge && normalizar(badge.textContent) === 'assinado';
    }).length;

    cartoes[0].textContent = pad(linhas.length);
    cartoes[1].textContent = pad(assinados);
    cartoes[2].textContent = pad(linhas.length - assinados);
  }

  function iniciarContratos() {
    var tituloPagina = document.querySelector('.main h1');
    if (!tituloPagina || normalizar(tituloPagina.textContent) !== 'contratos') return;

    var tabela = document.querySelector('.main .table-card table');
    if (!tabela) return;

    function renderTabela() {
      tabela.tBodies[0].innerHTML = Banco.contratos.map(function (contrato) {
        var assinado = !!contrato.assinado;
        return '<tr data-contrato-id="' + esc(contrato.id) + '">' +
          '<td class="name">' + esc(contrato.cliente) + '</td>' +
          '<td>' + esc(contrato.servico) + '</td>' +
          '<td><span class="badge ' + (assinado ? 'badge-ok' : 'badge-warn') + '">' +
          (assinado ? 'Assinado' : 'Pendente') + '</span></td>' +
          '<td><a href="#" class="small" style="color:var(--brown-500); font-weight:600;">' +
          (assinado ? 'Ver contrato' : 'Assinar contrato') + '</a></td>' +
          '<td class="row-actions"><button type="button" class="icon-btn" ' +
          'data-acao="ver-contrato" aria-label="Ações do contrato">⋮</button></td>' +
          '</tr>';
      }).join('');

      var totais = Banco.totaisContratos();
      var cartoes = document.querySelectorAll('.main .card h2');
      if (cartoes.length >= 3) {
        cartoes[0].textContent = pad(totais.total);
        cartoes[1].textContent = pad(totais.assinados);
        cartoes[2].textContent = pad(totais.pendentes);
      }
    }

    renderTabela();

    // Botão "Novo contrato": cria o contrato como PENDENTE. O sistema gera sozinho a
    // pendência "Contrato aguardando assinatura" e a resolve quando ele for assinado.
    var botaoNovo = document.getElementById('btnNovoContrato');
    if (botaoNovo) {
      botaoNovo.addEventListener('click', function () {
        var clientes = Banco.clientes;
        var servicos = nomesDeServico();
        if (!clientes.length) { toast('Cadastre uma cliente antes de criar um contrato.'); return; }

        modalGenerico({
          titulo: 'Novo contrato',
          subtitulo: 'O contrato começa como pendente, aguardando assinatura',
          html: campoHTML({ nome: 'cliente', label: 'Cliente', valor: String(clientes[0].id),
                            opcoes: opcoesDeClientes(clientes) }) +
                campoHTML({ nome: 'servico', label: 'Serviço', valor: servicos[0], opcoes: servicos }),
          acoes: [
            { rotulo: 'Cancelar' },
            {
              rotulo: 'Criar contrato', variante: 'primary',
              aoClicar: async function (ctx) {
                var dados = lerCampos(ctx.corpo);
                var cliente = acharClientePorId(Banco.clientes, dados.cliente);
                var servico = Banco.servicoPorNome(dados.servico);
                if (!cliente || !servico) { toast('Escolha a cliente e o serviço.'); return; }
                if (Banco.contratoDoCliente(cliente, servico.nome)) {
                  toast(cliente.nome + ' já tem contrato de ' + servico.nome + '.');
                  return;
                }
                try {
                  await Banco.criarContrato({
                    cliente_id: cliente.id, cliente: cliente.nome,
                    servico_id: servico.id, servico: servico.nome, valor: servico.valor
                  });
                  renderTabela();
                  fecharGenerico();
                  toast('Contrato de ' + cliente.nome + ' criado. Veja a pendência em Pendências.');
                } catch (erro) {
                  avisarErro(erro);
                }
              }
            }
          ]
        });
      });
    }

    tabela.addEventListener('click', function (evento) {
      var alvo = evento.target.closest('a.small, [data-acao="ver-contrato"]');
      if (!alvo) return;
      var linha = alvo.closest('tr');
      if (!linha) return;
      evento.preventDefault();
      evento.stopPropagation();
      abrirContrato(linha);
    });
  }

  /* ------------------------------- 12. Pendências ------------------------- */

  var TIPOS_PENDENCIA = {
    contrato: 'Contrato',
    exame: 'Exame',
    confirmacao: 'Confirmação',
    anotacao: 'Anotação',
    outro: 'Outro'
  };

  function iniciarPendencias() {
    var tituloPagina = document.querySelector('.main h1');
    if (!tituloPagina || normalizar(tituloPagina.textContent) !== 'pendências') return;

    var tabela = document.querySelector('.main .table-card table');
    if (!tabela) return;

    var corpo = tabela.tBodies[0];

    var ROTULO_TIPO = {
      contrato: 'Contrato',
      exame: 'Exame',
      confirmacao: 'Confirmação',
      anotacao: 'Anotação',
      pagamento: 'Pagamento',
      outro: 'Outro'
    };

    function atualizarContadores() {
      var cartoes = document.querySelectorAll('.main .card h2');
      if (cartoes.length < 3) return;

      var abertas = Banco.pendenciasAbertas();
      cartoes[0].textContent = pad(abertas.length);
      cartoes[1].textContent = pad(abertas.filter(function (p) { return p.tipo === 'contrato'; }).length);
      cartoes[2].textContent = pad(abertas.filter(function (p) { return p.tipo === 'anotacao'; }).length);
    }

    function ligarLinha(linha, pendencia) {
      linha.dataset.destino = urlFicha(pendencia.cliente_id != null ? pendencia.cliente_id : pendencia.cliente);
      linha.addEventListener('click', function () { irPara(linha.dataset.destino); });

      var botao = linha.querySelector('[data-acao="acoes-pendencia"]');
      if (!botao) return;

      botao.addEventListener('click', function (evento) {
        evento.stopPropagation();

        modalGenerico({
          titulo: pendencia.cliente,
          subtitulo: pendencia.descricao,
          html: '<p class="small muted" style="margin:0;">Tipo: ' +
            esc(ROTULO_TIPO[pendencia.tipo] || 'Outro') + '</p>',
          acoes: [
            {
              rotulo: 'Abrir ficha',
              aoClicar: function () { irPara(linha.dataset.destino); }
            },
            {
              rotulo: 'Resolver pendência', variante: 'primary',
              aoClicar: async function () {
                try {
                  await Banco.resolverPendencia(pendencia);
                  renderTabela();
                  atualizarContadores();
                  fecharGenerico();
                  toast('Pendência de ' + pendencia.cliente + ' resolvida.');
                } catch (erro) {
                  avisarErro(erro);
                }
              }
            }
          ]
        });
      });
    }

    function renderTabela() {
      corpo.innerHTML = '';

      Banco.pendenciasAbertas().forEach(function (pendencia) {
        var linha = document.createElement('tr');
        linha.innerHTML =
          '<td class="name">' + esc(pendencia.cliente) + '</td>' +
          '<td>' + esc(pendencia.descricao) + '</td>' +
          '<td>' + esc(ROTULO_TIPO[pendencia.tipo] || 'Outro') + '</td>' +
          '<td><span class="badge badge-warn">Aberta</span></td>' +
          '<td class="row-actions"><button type="button" class="icon-btn" ' +
          'data-acao="acoes-pendencia" aria-label="Ações da pendência">⋮</button></td>';

        ligarLinha(linha, pendencia);
        corpo.appendChild(linha);
      });
    }

    renderTabela();
    atualizarContadores();

    // Botão "Nova pendência": cria uma pendência manual (inclusive de pagamento).
    var botaoNova = document.getElementById('btnNovaPendencia');
    if (botaoNova) {
      botaoNova.addEventListener('click', function () {
        var clientes = Banco.clientes;
        if (!clientes.length) { toast('Cadastre uma cliente antes de criar uma pendência.'); return; }
        var rotulos = Object.keys(ROTULO_TIPO).map(function (k) { return ROTULO_TIPO[k]; });

        modalGenerico({
          titulo: 'Nova pendência',
          subtitulo: 'Registre o que precisa de atenção',
          html: campoHTML({ nome: 'cliente', label: 'Cliente', valor: String(clientes[0].id),
                            opcoes: opcoesDeClientes(clientes) }) +
                campoHTML({ nome: 'tipo', label: 'Tipo', valor: ROTULO_TIPO.outro, opcoes: rotulos }) +
                campoHTML({ nome: 'descricao', label: 'Descrição', linha: 2 }),
          acoes: [
            { rotulo: 'Cancelar' },
            {
              rotulo: 'Salvar', variante: 'primary',
              aoClicar: async function (ctx) {
                var dados = lerCampos(ctx.corpo);
                var cliente = acharClientePorId(clientes, dados.cliente);
                var tipo = Object.keys(ROTULO_TIPO).filter(function (k) { return ROTULO_TIPO[k] === dados.tipo; })[0] || 'outro';
                if (!cliente || !dados.descricao) { toast('Preencha a descrição da pendência.'); return; }
                try {
                  await Banco.criarPendencia({
                    cliente_id: cliente.id, cliente: cliente.nome, tipo: tipo, descricao: dados.descricao
                  });
                  renderTabela();
                  atualizarContadores();
                  fecharGenerico();
                  toast('Pendência criada para ' + cliente.nome + '.');
                } catch (erro) {
                  avisarErro(erro);
                }
              }
            }
          ]
        });
      });
    }
  }

  /* ------------------------------- 13. Relatórios ------------------------- */

  function iniciarRelatorios() {
    var select = document.getElementById('periodo');
    if (!select) return;

    var CHAVES = { 'Últimos 30 dias': '30d', 'Últimos 6 meses': '6m', 'Este ano': 'ano' };

    function barra(rotulo, total, maximo) {
      var largura = maximo ? Math.max(4, Math.round(total * 100 / maximo)) : 0;
      return '<div style="display:grid; grid-template-columns:minmax(90px,150px) 1fr 32px; align-items:center; gap:12px;">' +
        '<span class="small">' + esc(rotulo) + '</span>' +
        '<div style="background:var(--line); border-radius:6px; height:12px;"><div style="width:' + largura +
        '%; background:var(--brown-500); height:100%; border-radius:6px;"></div></div>' +
        '<b class="small">' + total + '</b></div>';
    }

    function desenhar() {
      var r = Banco.relatorio(CHAVES[select.value] || '30d');

      document.getElementById('relAtend').textContent = pad(r.atendimentos);
      document.getElementById('relNovas').textContent = pad(r.novasClientes);
      document.getElementById('relPend').textContent = pad(r.pendencias);

      var maxServico = r.servicos.length ? r.servicos[0].total : 0;
      document.getElementById('relServicos').innerHTML = r.servicos.length
        ? r.servicos.map(function (x) { return barra(x.nome, x.total, maxServico); }).join('')
        : '<p class="small muted">Nenhum atendimento registrado neste período.</p>';

      var maxMes = Math.max.apply(null, r.meses.map(function (m) { return m.total; }).concat([1]));
      document.getElementById('relMeses').innerHTML = r.meses.map(function (m) {
        var altura = m.total ? Math.max(6, Math.round(m.total * 120 / maxMes)) : 2;
        return '<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:6px;">' +
          '<b class="small">' + m.total + '</b>' +
          '<div style="width:100%; max-width:36px; height:' + altura + 'px; background:var(--brown-500); border-radius:6px 6px 0 0;"></div>' +
          '<span class="small muted">' + esc(capitalizar(m.rotulo)) + '</span></div>';
      }).join('');

      document.getElementById('relTabela').innerHTML = r.servicos.length
        ? r.servicos.map(function (x) {
            return '<tr><td class="name">' + esc(x.nome) + '</td><td>' + x.total + '</td><td>' +
              Math.round(x.total * 100 / r.atendimentos) + '%</td></tr>';
          }).join('')
        : '<tr><td colspan="3" class="muted">Sem atendimentos no período.</td></tr>';

      // Resumo montado só com os números acima (nada inventado).
      var linhas = [];
      if (!r.atendimentos) {
        linhas.push('Nenhum atendimento registrado em ' + select.value.toLowerCase() + '.');
      } else {
        var topo = r.servicos[0];
        linhas.push(topo.nome + ' foi o serviço mais atendido: ' + topo.total + ' de ' + r.atendimentos +
          ' (' + Math.round(topo.total * 100 / r.atendimentos) + '%).');
        var melhorMes = r.meses.slice().sort(function (a, b) { return b.total - a.total; })[0];
        if (melhorMes.total) linhas.push('Nos últimos 6 meses, ' + capitalizar(melhorMes.rotulo) + ' teve o maior movimento (' + melhorMes.total + ' atendimentos).');
      }
      linhas.push((r.novasClientes === 0 ? 'Nenhuma cliente nova' : r.novasClientes + (r.novasClientes === 1 ? ' cliente nova cadastrada' : ' clientes novas cadastradas')) + ' no período.');
      linhas.push(r.pendencias + (r.pendencias === 1 ? ' pendência aberta' : ' pendências abertas') + ' agora.');
      document.getElementById('relAiOutput').innerHTML = linhas.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    }

    select.addEventListener('change', desenhar);
    desenhar();
  }

  /* -------------------------------- 14. Agenda ---------------------------- */

  /** Agendamentos agrupados por dia (vindos da API ou do armazenamento local). */
  function carregarEventos() {
    return Banco.eventosPorDia();
  }

  function iniciarAgenda() {
    var grid = document.getElementById('calGrid');
    if (!grid) return;

    var titulo = document.getElementById('calTitulo');
    var calHead = document.getElementById('calHead');
    var botaoHoje = document.getElementById('btnHoje');
    var botaoAnterior = document.getElementById('btnAnterior');
    var botaoSeguinte = document.getElementById('btnSeguinte');
    var botoesVisao = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));

    var modalAgendamento = document.getElementById('modalAgendamento');
    var modalDetalhes = document.getElementById('modalDetalhes');
    var formulario = document.getElementById('formAgendamento');

    // As listas do formulário vêm do cadastro compartilhado, e não de valores fixos.
    var seletorCliente = document.getElementById('clienteAgendamento');
    if (seletorCliente) {
      seletorCliente.innerHTML = '<option value="">Selecione a cliente</option>' +
        opcoesDeClientes(carregarClientes()).map(function (opcao) {
          return '<option value="' + esc(opcao.valor) + '">' + esc(opcao.rotulo) + '</option>';
        }).join('');
    }

    var seletorServico = document.getElementById('servicoAgendamento');
    if (seletorServico) {
      seletorServico.innerHTML = '<option value="">Selecione o serviço</option>' +
        nomesDeServico().map(function (nome) {
          return '<option value="' + esc(nome) + '">' + esc(nome) + '</option>';
        }).join('');
    }

    var eventos = carregarEventos();
    var modo = 'mes';
    var dataRef = new Date();

    function eventosDoDia(iso, lista) {
      if (!lista || !lista.length) return '';
      return lista
        .map(function (evento, indice) { return { evento: evento, indice: indice }; })
        .sort(function (a, b) { return String(a.evento.t).localeCompare(String(b.evento.t)); })
        .map(function (par) {
          var ev = par.evento;
          return '<div class="cal-event ' + esc(ev.c || 'peach') + '"' +
            ' role="button" tabindex="0"' +
            ' data-data="' + iso + '" data-indice="' + par.indice + '"' +
            ' title="' + esc(ev.t + ' · ' + ev.w) + '">' +
            '<b>' + esc(ev.t) + '</b>' + esc(ev.w) +
            '</div>';
        })
        .join('');
    }

    function renderMes() {
      var ano = dataRef.getFullYear();
      var mes = dataRef.getMonth();

      calHead.hidden = false;
      grid.className = 'cal-grid';
      titulo.textContent = capitalizar(dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

      var hoje = hojeISO();
      var celulas = [];
      var primeiroDia = new Date(ano, mes, 1).getDay();
      var totalDias = new Date(ano, mes + 1, 0).getDate();

      for (var i = primeiroDia; i > 0; i--) celulas.push(new Date(ano, mes, 1 - i));
      for (var d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d));
      var proximo = 1;
      while (celulas.length < 42) celulas.push(new Date(ano, mes + 1, proximo++));

      grid.innerHTML = celulas.map(function (data) {
        var iso = toISODate(data);
        var fora = data.getMonth() !== mes;
        return '<div class="cal-cell' + (fora ? ' out' : '') + (iso === hoje ? ' today' : '') + '">' +
          '<span class="cal-num">' + data.getDate() + '</span>' +
          (fora ? '' : eventosDoDia(iso, eventos[iso])) +
          '</div>';
      }).join('');
    }

    function renderSemana() {
      calHead.hidden = false;
      grid.className = 'cal-grid is-week';

      var inicio = new Date(dataRef);
      inicio.setDate(inicio.getDate() - inicio.getDay());
      var fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);

      titulo.textContent = pad(inicio.getDate()) + '/' + pad(inicio.getMonth() + 1) +
        ' a ' + pad(fim.getDate()) + '/' + pad(fim.getMonth() + 1) + ' de ' + fim.getFullYear();

      var hoje = hojeISO();
      var html = '';

      for (var i = 0; i < 7; i++) {
        var data = new Date(inicio);
        data.setDate(inicio.getDate() + i);
        var iso = toISODate(data);
        html += '<div class="cal-cell' + (iso === hoje ? ' today' : '') + '">' +
          '<span class="cal-num">' + data.getDate() + ' · ' + DIAS_CURTOS[data.getDay()] + '</span>' +
          eventosDoDia(iso, eventos[iso]) +
          '</div>';
      }

      grid.innerHTML = html;
    }

    function renderDia() {
      calHead.hidden = true;
      grid.className = 'cal-grid is-day';

      var iso = toISODate(dataRef);
      var lista = eventos[iso] || [];

      titulo.textContent = capitalizar(dataRef.toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      }));

      if (!lista.length) {
        grid.innerHTML = '<div class="cal-cell"><p class="cal-empty">Nenhum agendamento para este dia.</p></div>';
        return;
      }

      grid.innerHTML = '<div class="cal-cell"><div class="agenda-list">' +
        lista
          .map(function (evento, indice) { return { evento: evento, indice: indice }; })
          .sort(function (a, b) { return String(a.evento.t).localeCompare(String(b.evento.t)); })
          .map(function (par) {
            return '<div class="agenda-item">' +
              '<span class="time">' + esc(par.evento.t) + '</span>' +
              '<span class="who">' + esc(par.evento.w) + '</span>' +
              '<span class="what muted">' + esc(par.evento.servico || 'Atendimento') + '</span>' +
              '<button type="button" class="icon-btn"' +
              ' data-data="' + iso + '" data-indice="' + par.indice + '"' +
              ' aria-label="Ver detalhes do agendamento">⋮</button>' +
              '</div>';
          })
          .join('') +
        '</div></div>';
    }

    function render() {
      if (modo === 'dia') renderDia();
      else if (modo === 'semana') renderSemana();
      else renderMes();
    }

    function abrirDetalhes(iso, indice) {
      var evento = (eventos[iso] || [])[indice];
      if (!evento) return;

      preencher('detalheCliente', evento.w);
      preencher('detalheData', formatarBR(iso));
      preencher('detalheHora', evento.t);
      preencher('detalheServico', evento.servico || 'Não informado');
      preencher('detalheObservacao', evento.observacao || 'Nenhuma observação.');

      // O botão de excluir existe apenas quando o registro tem id (banco).
      var rodape = document.querySelector('#modalDetalhes .modal-actions');
      if (rodape) {
        var antigo = rodape.querySelector('[data-excluir-agendamento]');
        if (antigo) antigo.remove();

        if (evento.id) {
          var excluir = document.createElement('button');
          excluir.type = 'button';
          excluir.className = 'btn btn-ghost';
          excluir.setAttribute('data-excluir-agendamento', '1');
          excluir.textContent = 'Excluir agendamento';
          excluir.addEventListener('click', async function () {
            try {
              await Banco.removerAgendamento(evento.id);
              eventos = Banco.eventosPorDia();
              fecharOverlay(modalDetalhes);
              render();
              toast('Agendamento excluído.');
            } catch (erro) {
              avisarErro(erro);
            }
          });
          rodape.insertBefore(excluir, rodape.firstChild);
        }

        // Reagendar / alterar: só para consultas que existem no banco e ainda estão marcadas.
        var antigoReagendar = rodape.querySelector('[data-reagendar-agendamento]');
        if (antigoReagendar) antigoReagendar.remove();

        if (evento.id && (!evento.status || evento.status === 'agendado')) {
          var reagendar = document.createElement('button');
          reagendar.type = 'button';
          reagendar.className = 'btn btn-primary';
          reagendar.setAttribute('data-reagendar-agendamento', '1');
          reagendar.textContent = 'Reagendar';
          reagendar.addEventListener('click', function () {
            fecharOverlay(modalDetalhes);
            abrirReagendamento(iso, evento);
          });
          rodape.insertBefore(reagendar, rodape.firstChild);
        }
      }

      abrirOverlay(modalDetalhes);
    }

    /** Janela para mudar data, horário, serviço e observação de uma consulta (RF08). */
    function abrirReagendamento(iso, evento) {
      var servicos = nomesDeServico();
      modalGenerico({
        titulo: 'Reagendar consulta',
        subtitulo: evento.w,
        html: campoHTML({ nome: 'data', label: 'Data', tipo: 'date', valor: iso, attrs: { min: hojeISO() } }) +
              campoHTML({ nome: 'hora', label: 'Horário', tipo: 'time', valor: evento.t }) +
              campoHTML({ nome: 'servico', label: 'Serviço', valor: evento.servico || servicos[0], opcoes: servicos }) +
              campoHTML({ nome: 'observacao', label: 'Observação', valor: evento.observacao || '', linha: 2 }),
        acoes: [
          { rotulo: 'Cancelar' },
          {
            rotulo: 'Salvar alterações', variante: 'primary',
            aoClicar: async function (ctx) {
              var dados = lerCampos(ctx.corpo);
              if (!dados.data || !dados.hora) { toast('Informe a data e o horário.'); return; }
              var servicoBanco = Banco.servicoPorNome(dados.servico);
              try {
                await Banco.atualizarAgendamento(evento.id, {
                  inicio: dados.data + ' ' + dados.hora + ':00',
                  servico: dados.servico,
                  servico_id: servicoBanco ? servicoBanco.id : null,
                  observacao: dados.observacao
                });
              } catch (erro) {
                avisarErro(erro);
                return;
              }
              eventos = Banco.eventosPorDia();
              dataRef = fromISODate(dados.data);
              if (modo === 'mes') dataRef = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
              render();
              fecharGenerico();
              toast('Consulta de ' + evento.w + ' reagendada para ' + formatarBR(dados.data) + ' às ' + dados.hora + '.');
            }
          }
        ]
      });
    }

    function definirModo(novoModo) {
      modo = novoModo;
      if (modo === 'mes') dataRef = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
      botoesVisao.forEach(function (botao) {
        botao.classList.toggle('active', botao.dataset.view === modo);
      });
      render();
    }

    function deslocar(passo) {
      if (modo === 'mes') {
        dataRef = new Date(dataRef.getFullYear(), dataRef.getMonth() + passo, 1);
      } else {
        dataRef = new Date(dataRef);
        dataRef.setDate(dataRef.getDate() + (modo === 'semana' ? passo * 7 : passo));
      }
      render();
    }

    botoesVisao.forEach(function (botao) {
      botao.addEventListener('click', function () { definirModo(botao.dataset.view); });
    });

    if (botaoHoje) botaoHoje.addEventListener('click', function () {
      dataRef = new Date();
      render();
    });
    if (botaoAnterior) botaoAnterior.addEventListener('click', function () { deslocar(-1); });
    if (botaoSeguinte) botaoSeguinte.addEventListener('click', function () { deslocar(1); });

    grid.addEventListener('click', function (evento) {
      var alvo = evento.target.closest('[data-data][data-indice]');
      if (!alvo) return;
      abrirDetalhes(alvo.dataset.data, Number(alvo.dataset.indice));
    });

    grid.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      var alvo = evento.target.closest('.cal-event');
      if (!alvo) return;
      evento.preventDefault();
      abrirDetalhes(alvo.dataset.data, Number(alvo.dataset.indice));
    });

    var abrirAgendamento = document.getElementById('btnNovoAgendamento');
    var fecharAgendamento = document.getElementById('fecharModal');
    var cancelarAgendamento = document.getElementById('cancelarAgendamento');
    var fecharDetalhes = document.getElementById('fecharDetalhes');
    var okDetalhes = document.getElementById('fecharDetalhesBotao');

    if (abrirAgendamento) abrirAgendamento.addEventListener('click', function () {
      var campoData = document.getElementById('dataAgendamento');
      if (campoData) campoData.min = hojeISO(); // o calendário não deixa escolher dia que já passou
      if (campoData && !campoData.value) campoData.value = hojeISO();
      abrirOverlay(modalAgendamento);
      var primeiro = modalAgendamento.querySelector('select, input');
      if (primeiro) primeiro.focus();
    });

    if (fecharAgendamento) fecharAgendamento.addEventListener('click', function () { fecharOverlay(modalAgendamento); });
    if (cancelarAgendamento) cancelarAgendamento.addEventListener('click', function () { fecharOverlay(modalAgendamento); });
    if (fecharDetalhes) fecharDetalhes.addEventListener('click', function () { fecharOverlay(modalDetalhes); });
    if (okDetalhes) okDetalhes.addEventListener('click', function () { fecharOverlay(modalDetalhes); });

    if (formulario) {
      formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();

        var clienteId = document.getElementById('clienteAgendamento').value;
        var data = document.getElementById('dataAgendamento').value;
        var hora = document.getElementById('horaAgendamento').value;
        var servico = document.getElementById('servicoAgendamento').value;
        var observacao = document.getElementById('observacaoAgendamento').value;

        if (!clienteId || !data || !hora || !servico) {
          toast('Preencha cliente, data, horário e serviço.');
          return;
        }

        if (Banco.horarioJaPassou(data + ' ' + hora)) {
          toast('Não é possível agendar em data ou horário que já passou.');
          return;
        }

        var cadastro = acharClientePorId(Banco.clientes, clienteId);
        if (!cadastro) { toast('Escolha uma cliente da lista.'); return; }
        var cliente = cadastro.nome;
        var servicoBanco = Banco.servicoPorNome(servico);

        try {
          await Banco.criarAgendamento({
            cliente_id: cadastro.id,
            cliente: cliente,
            servico_id: servicoBanco ? servicoBanco.id : null,
            servico: servico,
            inicio: data + ' ' + hora + ':00',
            observacao: observacao || ''
          });
        } catch (erro) {
          avisarErro(erro);
          return;
        }

        eventos = Banco.eventosPorDia();

        dataRef = fromISODate(data);
        if (modo === 'mes') dataRef = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
        render();

        formulario.reset();
        fecharOverlay(modalAgendamento);
        toast('Agendamento de ' + cliente + ' salvo em ' + formatarBR(data) + ' às ' + hora + '.');
      });
    }

    definirModo('mes');
  }

  /* ------------------------------- 15. Login ------------------------------ */

  function iniciarLogin() {
    var formulario = document.getElementById('formLogin');
    if (!formulario) return;

    formulario.addEventListener('submit', async function (evento) {
      evento.preventDefault();

      var email = (document.getElementById('loginEmail') || {}).value || '';
      var senha = (document.getElementById('loginSenha') || {}).value || '';

      // A API pode ter sido ligada depois que a página abriu: tenta de novo antes de desistir.
      if (Banco.modo !== 'api') {
        try { await Banco.carregar(); } catch (erro) { /* segue para o aviso abaixo */ }
      }

      if (Banco.modo === 'api') {
        try {
          var usuario = await Banco.pedir('/auth/login', {
            method: 'POST',
            corpo: { email: email.trim(), senha: senha }
          });
          Banco.guardarSessao(usuario);
          toast('Bem-vinda, ' + usuario.nome + '.');
          var destino = usuario.precisa_trocar_senha ? 'configuracoes.html?obrigatorio=1' : 'dashboard.html';
          window.setTimeout(function () { irPara(destino); }, 400);
        } catch (erro) {
          toast(erro.message || 'Não foi possível entrar.');
        }
        return;
      }

      // Sem a API não há como conferir a senha: ninguém entra.
      toast('Servidor indisponível. Ligue a API (npm start na pasta server) e tente de novo.');
    });
  }

  /* ------------------- Recuperação de senha (por e-mail) ------------------ */

  function iniciarEsqueciSenha() {
    var formulario = document.getElementById('formEsqueciSenha');
    if (!formulario) return;

    var ESPERA_SEGUNDOS = 60;   // só dá para reenviar depois de 1 minuto
    var MAX_ENVIOS = 3;         // mesmo limite da API (3 a cada 15 minutos)

    var mensagem = document.getElementById('esqueciMensagem');
    var botao = document.getElementById('btnEsqueci');
    var campoEmail = document.getElementById('esqueciEmail');
    var telaEnviado = document.getElementById('esqueciEnviado');
    var contagem = document.getElementById('esqueciContagem');
    var botaoReenviar = document.getElementById('btnReenviar');
    var temporizador = null;
    var envios = 0;
    var emailAtual = '';

    function dois(n) { return (n < 10 ? '0' : '') + n; }

    /** Cronômetro visível; ao zerar, libera o botão de reenviar. */
    function iniciarContagem() {
      var termina = Date.now() + ESPERA_SEGUNDOS * 1000;
      botaoReenviar.disabled = true;
      window.clearInterval(temporizador);

      function atualizar() {
        var restante = Math.max(0, Math.ceil((termina - Date.now()) / 1000));
        if (restante > 0) {
          contagem.innerHTML = 'Você poderá reenviar em <strong>' + dois(Math.floor(restante / 60)) + ':' + dois(restante % 60) + '</strong>';
          return;
        }
        window.clearInterval(temporizador);
        if (envios >= MAX_ENVIOS) {
          contagem.textContent = 'Você já pediu o envio ' + MAX_ENVIOS + ' vezes. Aguarde cerca de 15 minutos para tentar de novo.';
          return;
        }
        contagem.textContent = 'Agora você já pode reenviar.';
        botaoReenviar.disabled = false;
      }

      atualizar();
      temporizador = window.setInterval(atualizar, 250);
    }

    async function pedir(email) {
      // A API pode ter sido ligada depois que a página abriu.
      if (Banco.modo !== 'api') {
        try { await Banco.carregar(); } catch (erro) { /* segue para o aviso */ }
      }
      await Banco.esqueciSenha(email);
      envios += 1;
    }

    formulario.addEventListener('submit', async function (evento) {
      evento.preventDefault();
      mensagem.textContent = '';
      mensagem.style.color = 'var(--ink-muted)';

      var email = campoEmail.value.trim();
      botao.disabled = true;
      botao.textContent = 'Enviando...';

      try {
        envios = 0;
        await pedir(email);
        emailAtual = email;
        document.getElementById('esqueciEnviadoPara').textContent = email;
        formulario.style.display = 'none';
        telaEnviado.style.display = 'block';
        toast('E-mail enviado para ' + email + '.');
        iniciarContagem();
      } catch (falha) {
        mensagem.style.color = 'var(--warn-tx)';
        mensagem.textContent = falha.message || 'Não foi possível enviar agora.';
      } finally {
        botao.disabled = false;
        botao.textContent = 'Enviar link';
      }
    });

    botaoReenviar.addEventListener('click', async function () {
      botaoReenviar.disabled = true;
      botaoReenviar.textContent = 'Enviando...';
      try {
        await pedir(emailAtual);
        toast('E-mail reenviado para ' + emailAtual + '.');
        iniciarContagem();
      } catch (falha) {
        contagem.textContent = falha.message || 'Não foi possível reenviar agora.';
        botaoReenviar.disabled = false;
      } finally {
        botaoReenviar.textContent = 'Reenviar e-mail';
      }
    });

    document.getElementById('esqueciOutroEmail').addEventListener('click', function (evento) {
      evento.preventDefault();
      window.clearInterval(temporizador);
      telaEnviado.style.display = 'none';
      formulario.style.display = 'block';
      campoEmail.focus();
    });
  }

  function iniciarRedefinirSenha() {
    var formulario = document.getElementById('formRedefinirSenha');
    if (!formulario) return;

    var token = new URLSearchParams(window.location.search).get('token') || '';
    var campos = document.getElementById('redefinirCampos');
    var aviso = document.getElementById('redefinirInvalido');
    var erro = document.getElementById('redefinirErro');
    var botao = document.getElementById('btnRedefinir');

    function linkInvalido() {
      aviso.style.display = 'block';
      campos.style.display = 'none';
    }

    if (!token) { linkInvalido(); return; }

    formulario.addEventListener('submit', async function (evento) {
      evento.preventDefault();
      erro.textContent = '';

      var nova = document.getElementById('redefinirNova').value;
      var confirmacao = document.getElementById('redefinirConfirma').value;
      if (nova !== confirmacao) { erro.textContent = 'As duas senhas não são iguais.'; return; }
      if (nova.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }

      if (Banco.modo !== 'api') {
        try { await Banco.carregar(); } catch (falhaCarga) { /* segue para o aviso */ }
      }

      botao.disabled = true;
      try {
        await Banco.redefinirSenha(token, nova);
        toast('Senha alterada. Entre com a nova senha.');
        window.setTimeout(function () { irPara('login.html'); }, 1500);
      } catch (falha) {
        if (/não é mais válido/.test(falha.message || '')) { linkInvalido(); }
        else { erro.textContent = falha.message || 'Não foi possível salvar a senha.'; botao.disabled = false; }
      }
    });
  }

  /* ------------------------- Configurações (conta e senha) ---------------- */

  function iniciarConfiguracoes() {
    var formulario = document.getElementById('formTrocarSenha');
    if (!formulario) return;

    var sessao = Banco.usuario() || {};
    document.getElementById('contaNome').textContent = sessao.nome || '—';
    document.getElementById('contaEmail').textContent = sessao.email || '—';

    var obrigatorio = /[?&]obrigatorio=1/.test(window.location.search);
    if (obrigatorio) document.getElementById('avisoSenhaObrigatoria').style.display = 'block';

    var erro = document.getElementById('erroSenha');
    var botao = document.getElementById('btnTrocarSenha');

    formulario.addEventListener('submit', async function (evento) {
      evento.preventDefault();
      erro.textContent = '';

      var atual = document.getElementById('senhaAtual').value;
      var nova = document.getElementById('senhaNova').value;
      var confirmacao = document.getElementById('senhaConfirma').value;

      if (nova !== confirmacao) { erro.textContent = 'As duas novas senhas não são iguais.'; return; }
      if (nova.length < 8) { erro.textContent = 'A nova senha precisa ter pelo menos 8 caracteres.'; return; }

      botao.disabled = true;
      try {
        await Banco.trocarSenha(atual, nova);
        formulario.reset();
        toast('Senha alterada com sucesso.');
        if (obrigatorio) window.setTimeout(function () { irPara('dashboard.html'); }, 800);
      } catch (falha) {
        erro.textContent = falha.message || 'Não foi possível trocar a senha.';
      } finally {
        botao.disabled = false;
      }
    });
  }

  /** Botão "Sair" do menu: apaga o login guardado antes de ir para a tela de entrada. */
  function iniciarSair() {
    document.querySelectorAll('a[href="login.html"].nav-link').forEach(function (link) {
      link.addEventListener('click', function () { Banco.limparSessao(); });
    });
  }

  /* --------------------------- 16. Dashboard ------------------------------ */

  /** Preenche os cartões e as listas do Dashboard com os dados do banco. */
  function iniciarDashboard() {
    var conteudo = document.querySelector('.dashboard-content');
    if (!conteudo) return;

    function lista(itens, montar, vazio) {
      return itens && itens.length ? itens.map(montar).join('')
        : '<li class="muted small">' + vazio + '</li>';
    }

    function formatarDia(iso) {
      var partes = String(iso || '').slice(0, 10).split('-');
      return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : (iso || '—');
    }

    function diasAte(iso) {
      var alvo = new Date(String(iso).slice(0, 10) + 'T00:00:00');
      var hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return Math.round((alvo - hoje) / 86400000);
    }

    Promise.resolve(Banco.carregarDashboard()).then(function (dados) {
      if (!dados) return;

      var numeros = document.querySelectorAll('.dashboard-stats h2');
      if (numeros[0]) numeros[0].textContent = pad(dados.consultas_hoje || 0);
      if (numeros[1]) numeros[1].textContent = pad(dados.partos_previstos || 0);
      if (numeros[2]) numeros[2].textContent = pad(dados.pendencias_abertas || 0);

      var cartoes = Array.prototype.slice.call(conteudo.querySelectorAll('.card'));

      var cartaoAgenda = cartoes.filter(function (cartao) {
        var titulo = cartao.querySelector('h3');
        return titulo && /Agenda de hoje/i.test(titulo.textContent);
      })[0];

      if (cartaoAgenda) {
        cartaoAgenda.querySelector('.agenda-list').innerHTML = lista(
          dados.agenda_hoje,
          function (item) {
            return '<div class="agenda-item">' +
              '<span class="time">' + esc(String(item.inicio).slice(11, 16)) + '</span>' +
              '<span class="who">' + esc(item.cliente) + '</span>' +
              '<span class="what muted">' + esc(item.servico || '') + '</span>' +
              '</div>';
          },
          'Nenhum agendamento para hoje.'
        );
      }

      var cartaoPendencias = cartoes.filter(function (cartao) {
        var titulo = cartao.querySelector('h3');
        return titulo && /^Pendências$/i.test(titulo.textContent.trim());
      })[0];

      if (cartaoPendencias) {
        cartaoPendencias.querySelector('.pend-list').innerHTML = lista(
          dados.pendencias,
          function (item) {
            return '<li><span class="dot"></span><b>' + esc(item.cliente) + '</b>' +
              '<span class="muted small">' + esc(item.descricao) + '</span></li>';
          },
          'Nenhuma pendência aberta.'
        );
      }

      var cartaoPartos = cartoes.filter(function (cartao) {
        var titulo = cartao.querySelector('h3');
        return titulo && /data prevista do parto/i.test(titulo.textContent);
      })[0];

      if (cartaoPartos) {
        cartaoPartos.querySelector('.pend-list').innerHTML = lista(
          dados.proximos_partos,
          function (item) {
            var dias = item.dias_restantes !== undefined ? item.dias_restantes : diasAte(item.dpp);
            return '<li><b>' + esc(item.cliente) + '</b>' +
              '<span class="muted small">' + formatarDia(item.dpp) + ' · ' + dias + ' dias</span></li>';
          },
          'Nenhum parto previsto.'
        );
      }
    }).catch(function (erro) {
      console.warn('[Lírios] não foi possível carregar o dashboard.', erro);
    });
  }

  /* --------------------------- 17. Lembretes ------------------------------- */

  /** Card "Lembretes de amanhã" do Dashboard: lista, abre o WhatsApp e registra o envio. */
  function iniciarLembretes() {
    var lista = document.getElementById('listaLembretes');
    if (!lista) return;

    var rotulo = { pendente: 'Pendente', enviado: 'Enviado', confirmado: 'Confirmado' };

    function desenhar(itens) {
      var contador = document.getElementById('contadorLembretes');
      var faltam = itens.filter(function (l) { return l.status === 'pendente'; }).length;
      if (contador) contador.textContent = itens.length ? faltam + ' de ' + itens.length + ' a enviar' : '';

      if (!itens.length) {
        lista.innerHTML = '<li class="muted small">Nenhuma consulta agendada para amanhã.</li>';
        return;
      }

      lista.innerHTML = itens.map(function (l, i) {
        var acoes = l.link_whatsapp
          ? '<a class="btn btn-primary btn-sm" data-lembrete-enviar="' + i + '" href="' + esc(l.link_whatsapp) +
            '" target="_blank" rel="noopener">Enviar no WhatsApp</a>'
          : '<span class="muted small">Sem telefone válido</span>';
        var confirmar = l.status === 'enviado'
          ? ' <button type="button" class="btn btn-ghost btn-sm" data-lembrete-confirmar="' + i + '">Confirmou</button>'
          : '';
        return '<li class="lembrete-item" style="display:block; padding:10px 0; border-bottom:1px solid var(--cream-100);">' +
          '<div style="display:flex; justify-content:space-between; gap:8px;">' +
            '<span><b>' + esc(String(l.inicio).slice(11, 16)) + '</b> · ' + esc(l.cliente) +
            ' <span class="muted small">' + esc(l.servico) + '</span></span>' +
            '<span class="badge ' + (l.status === 'pendente' ? 'badge-warn' : 'badge-ok') + '">' + rotulo[l.status] + '</span>' +
          '</div>' +
          '<div style="margin-top:8px;">' + acoes + confirmar + '</div></li>';
      }).join('');
    }

    var itens = [];

    Promise.resolve(Banco.carregarLembretes()).then(function (dados) {
      itens = dados || [];
      desenhar(itens);
    }).catch(function (erro) {
      lista.innerHTML = '<li class="muted small">Não foi possível carregar os lembretes.</li>';
      console.warn('[Lírios] lembretes', erro);
    });

    // O clique no link abre o WhatsApp (comportamento do <a>); aqui só registramos o envio.
    lista.addEventListener('click', function (evento) {
      var enviar = evento.target.closest('[data-lembrete-enviar]');
      var confirmar = evento.target.closest('[data-lembrete-confirmar]');
      var alvo = enviar || confirmar;
      if (!alvo) return;
      var l = itens[Number(alvo.getAttribute(enviar ? 'data-lembrete-enviar' : 'data-lembrete-confirmar'))];
      if (!l) return;
      var novo = enviar ? (l.status === 'pendente' ? 'enviado' : l.status) : 'confirmado';
      Promise.resolve(Banco.marcarLembrete(l, novo)).then(function () {
        desenhar(itens);
      }).catch(function () { toast('Não foi possível registrar o lembrete.'); });
    });
  }

  /* ------------------------------ Inicialização --------------------------- */

  document.addEventListener('DOMContentLoaded', async function () {
    // 1) tenta a API (MySQL); se não responder, carrega do localStorage.
    await Banco.carregar();
    if (Banco.redirecionando) return; // sem login: já estamos indo para a tela de entrada

    if (Banco.modo === 'local' && document.querySelector('.main')) {
      console.info('[Lírios] modo local: a API não respondeu em ' + Banco.baseUrl);
    }

    // 2) só então as telas são montadas, já com os dados em cache.
    iniciarDataAtual();
    iniciarOverlays();
    iniciarMascaras();
    iniciarClientes();
    iniciarGestantes();
    iniciarMenuDaFicha();
    iniciarServicos();
    attachTabs('.tab-btn', '.tab-panel');
    iniciarCopiar();
    iniciarResumos();
    iniciarFicha();
    iniciarAtendimento();
    iniciarContratos();
    iniciarPendencias();
    iniciarRelatorios();
    iniciarAgenda();
    iniciarDashboard();
    iniciarLembretes();
    iniciarLogin();
    iniciarEsqueciSenha();
    iniciarRedefinirSenha();
    iniciarConfiguracoes();
    iniciarSair();
  });
})();
