Sistema de Gestão para o Instituto Lírios

TED 02 – Implementação da Interface da Aplicação

Integrantes

* Erika Vitoria Da Cruz Silva
* Kelry Silva De Sousa
* Victorya Lima Souza
* Pedro Rusvel Pinheiro Siqueira De Carvalho

⸻

1. Descrição do projeto

O Instituto Lírios atua no atendimento materno-infantil e em outros serviços de cuidados em saúde, mas não possui um sistema próprio para concentrar e organizar suas informações. A responsável utiliza ferramentas separadas, como WhatsApp, documentos do Word, pastas e Google Agenda, para registrar e consultar dados das clientes, atendimentos, contratos, agendamentos e pendências.

Esse controle manual dificulta o gerenciamento das atividades e a localização de informações do histórico de atendimento.

O problema identificado é a ausência de um sistema centralizado para organizar os dados das clientes e apoiar o acompanhamento dos atendimentos realizados pelo Instituto.

O projeto tem como objetivo desenvolver uma interface de sistema de gestão para centralizar essas informações, facilitar o acompanhamento das clientes e melhorar a organização da rotina de atendimento do Instituto Lírios.

⸻

2. Conjunto de dados utilizado

* Nome da base: Maternal Health Risk
* Identificação: ID 863 no UCI Machine Learning Repository
* DOI: 10.24432/C5DP5D
* Arquivo: Maternal_Health_Risk_Data_Set.csv
* Formato: CSV
* Quantidade: 1.013 registros segundo a documentação da UCI; o arquivo baixado contém 1.014 linhas de dados.
* Fonte dos dados: UCI Machine Learning Repository
* Origem: hospitais, clínicas comunitárias e serviços de saúde materna de áreas rurais de Bangladesh
* Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)

O arquivo está na pasta data/ deste repositório. Caso ele não esteja disponível, pode ser obtido diretamente no UCI Machine Learning Repository, na base Maternal Health Risk.

⸻

3. Tecnologias, bibliotecas e frameworks utilizados

A interface da aplicação foi desenvolvida utilizando tecnologias web fundamentais:

* HTML5 — utilizado para estruturar as páginas, conteúdos, formulários, tabelas, menus e componentes da aplicação;
* CSS3 — utilizado para estilização, identidade visual, organização do layout, componentes e responsividade;
* JavaScript (Vanilla JS) — utilizado para implementar as interações e comportamentos da interface;
* CSS Grid — utilizado para organização de conteúdos em colunas e criação dos principais layouts;
* Flexbox — utilizado para alinhamento e organização dos elementos da interface;
* SVG — utilizado para os ícones vetoriais presentes na aplicação;
* Google Fonts — utilizadas as famílias tipográficas Cormorant Garamond e Manrope;
* Web Storage API (localStorage) — utilizado para manter o cadastro de clientes, os agendamentos e os atendimentos no próprio navegador, entre recarregamentos da página.

Frameworks

O projeto não utiliza frameworks de frontend, como React, Angular ou Vue.

Também não foram utilizados frameworks ou bibliotecas de componentes como Bootstrap ou Tailwind CSS.

A implementação foi realizada com HTML5, CSS3 e JavaScript puro (Vanilla JavaScript), utilizando recursos nativos dos navegadores.

Essa abordagem foi adotada para manter a aplicação simples, organizada e adequada ao escopo da etapa de implementação da interface, permitindo também uma evolução futura para arquiteturas mais completas.

⸻

4. Estrutura da aplicação

A aplicação está organizada em páginas HTML independentes, compartilhando os arquivos de estilos e scripts.

Estrutura principal:

instituto-lirios/
│
├── assets/
│   ├── style.css          # estilos de todas as páginas
│   ├── banco.js           # acesso aos dados (API ou armazenamento local)
│   └── app.js             # interações de todas as páginas
│
├── data/
│   └── Maternal_Health_Risk_Data_Set.csv
│
├── db/                    # modelo de dados relacional (MySQL 8)
│   ├── schema.sql         # criação das tabelas, índices e views
│   ├── seed.sql           # dados iniciais
│   ├── consultas.sql      # consultas usadas por cada tela
│   ├── validar.py         # validação automatizada do modelo
│   └── README.md          # documentação e diagrama
│
├── server/                # API REST (Node.js + Express + MySQL)
│   ├── app.js             # configuração do Express e tratamento de erros
│   ├── server.js          # inicialização do servidor
│   ├── db.js              # pool de conexões e transações
│   ├── http.js            # validação de entrada e erros HTTP
│   ├── routes/            # um arquivo por recurso
│   ├── testes-api.js      # testes das rotas
│   └── README.md          # lista de endpoints e exemplos
│
├── index.html             # redireciona para login.html
├── login.html
├── dashboard.html
├── agenda.html
├── clientes.html
├── ficha-cliente.html
├── atendimento.html
├── contratos.html
├── servicos.html
├── relatorios.html
├── pendencias.html
└── README.md

A aplicação é composta por onze telas. Todas compartilham os mesmos dois arquivos de assets (style.css e app.js) e não possuem estilos ou scripts embutidos no HTML.

A pasta db/ contém o modelo de dados relacional em MySQL 8 que substituirá o armazenamento local na próxima etapa do projeto. A documentação completa, com o diagrama das tabelas e as decisões de modelagem, está em db/README.md.

Principais arquivos

dashboard.html

Página inicial do sistema. Apresenta um resumo das principais informações da rotina de atendimento, incluindo consultas, próximos partos, pendências, agenda do dia e resumo inteligente.

agenda.html

Página destinada à visualização e organização dos agendamentos.

clientes.html

Página de gerenciamento das clientes, contendo busca e listagem de registros.

ficha-cliente.html

Página com as informações detalhadas da cliente, organizada em abas para facilitar a consulta dos dados.

atendimento.html

Página destinada ao registro e acompanhamento das informações relacionadas aos atendimentos.

contratos.html

Página destinada ao acompanhamento dos contratos das clientes, com visualização da minuta e registro de assinatura.

servicos.html

Página de gerenciamento dos serviços oferecidos pelo Instituto, com cadastro, edição e acesso à lista de clientes de cada serviço.

relatorios.html

Página de acompanhamento dos indicadores do atendimento, com filtro por período, gráficos em CSS e resumo inteligente.

pendencias.html

Página que reúne as pendências abertas da rotina (contratos, exames, confirmações e anotações), com ação para resolvê-las.

login.html

Tela de acesso inicial ao sistema.

assets/style.css

Arquivo responsável pela identidade visual, layout, componentes, cards, tabelas, formulários, responsividade e demais estilos da aplicação.

assets/app.js

Arquivo único de JavaScript da aplicação. Concentra todas as interações da interface: pesquisa e filtro de clientes, cadastro e edição, navegação entre abas, resumo inteligente e cópia do resultado, edição dos dados da ficha, registro de atendimento, contratos, pendências, filtro de período dos relatórios, modal genérico de ações, calendário da Agenda (visualizações Dia, Semana e Mês) e a persistência local dos dados.

O arquivo está dividido em blocos comentados e cada bloco procura seus próprios elementos, encerrando caso a página atual não os possua. Assim, um único arquivo atende as onze telas sem gerar erros naquelas em que a funcionalidade não existe.

⸻

5. Interface desenvolvida

A interface foi desenvolvida seguindo a proposta visual definida para o projeto, utilizando uma identidade baseada em tons neutros, marrons e claros.

Foram utilizados cards, tabelas, formulários, menus de navegação, ícones e componentes interativos para facilitar a utilização do sistema.

5.1 Tela de Login

A tela de login apresenta a área de acesso ao sistema, mantendo a identidade visual utilizada nas demais páginas da aplicação.

5.2 Dashboard

O Dashboard funciona como página inicial do sistema e apresenta as principais informações de forma resumida.

Entre os elementos implementados estão:

* quantidade de consultas do dia;
* próximos partos;
* pendências;
* agenda de hoje;
* lista de pendências;
* próximas clientes da data prevista do parto;
* resumo inteligente.

O layout foi organizado em colunas para facilitar a visualização das informações em telas maiores.

5.3 Agenda

A tela de Agenda permite visualizar os compromissos e horários cadastrados em três formas de visualização:

* Dia — lista dos agendamentos da data selecionada;
* Semana — sete colunas, uma para cada dia da semana;
* Mês — grade completa do mês, com os agendamentos distribuídos nos dias.

A navegação permite avançar e retroceder o período exibido, e o botão Hoje retorna à data atual do sistema.

Também foram implementadas duas janelas modais: Novo Agendamento, com o formulário de cadastro, e Detalhes do agendamento, com as informações do compromisso selecionado.

5.4 Clientes

A tela de Clientes apresenta os registros das clientes e possui um campo de pesquisa.

A pesquisa é realizada de forma dinâmica utilizando JavaScript, permitindo localizar clientes pelo nome.

5.5 Ficha da cliente

A Ficha da Cliente apresenta informações detalhadas da cliente. A página é aberta a partir da cliente selecionada nas telas de Clientes ou de Pendências (ficha-cliente.html?cliente=...), exibindo os dados daquela cliente.

A interface utiliza abas para organizar os diferentes grupos de informações, permitindo alternar entre os conteúdos sem sair da página.

A aba Gestação é editável para qualquer cliente: quando não há dados, a tela oferece o botão Registrar dados da gestação; quando há, oferece Editar dados da gestação. A data prevista do parto é calculada a partir da data da última menstruação (DUM + 280 dias) e a idade gestacional é calculada automaticamente em semanas e dias.

5.6 Atendimento

A tela de Atendimento foi estruturada para apoiar o registro das informações relacionadas aos atendimentos realizados. A página é aberta a partir da cliente selecionada na ficha (atendimento.html?cliente=...), preenchendo cliente, serviço e data do atendimento.

5.7 Contratos

A tela de Contratos foi desenvolvida para organizar e acompanhar as informações relacionadas aos contratos das clientes. Permite consultar a minuta do contrato e registrar a assinatura, atualizando o status na tabela e os totais do topo da página.

5.8 Serviços

A tela de Serviços apresenta os serviços oferecidos pelo Instituto em formato de cards, com busca, cadastro e edição por modal. Cada card possui atalho para a lista de clientes daquele serviço.

5.9 Relatórios

A tela de Relatórios apresenta indicadores do período, distribuição dos atendimentos por serviço e por mês. O período pode ser alterado por um seletor, que atualiza os indicadores exibidos.

5.10 Pendências

A tela de Pendências reúne os itens que precisam de atenção na rotina do Instituto, com totais no topo e ações para abrir a ficha da cliente ou resolver a pendência.

⸻

6. Funcionalidades implementadas

Durante a implementação da interface foram desenvolvidas e testadas as seguintes funcionalidades:

Pesquisa e filtro de clientes

O usuário pode digitar um nome no campo de pesquisa e a tabela é filtrada dinamicamente para apresentar os resultados correspondentes. A busca considera o conteúdo da linha, permitindo localizar também por serviço, telefone ou e-mail.

Além da pesquisa, o botão Filtros permite restringir a listagem por status (todas, ativas ou pendentes), e os dois critérios podem ser usados em conjunto. Quando nenhum registro corresponde, a interface apresenta uma mensagem de estado vazio.

Essas funcionalidades são implementadas por meio de JavaScript, utilizando eventos de entrada no campo de pesquisa e manipulação dos elementos da tabela.

Cadastro e edição de clientes

O botão Nova cliente abre um modal com os campos básicos do cadastro (nome, data de nascimento, telefone, e-mail, serviço principal e status). Ao confirmar, a cliente é inserida na tabela sem recarregar a página.

O menu de ações de cada linha (⋮) permite abrir a ficha da cliente, editar o cadastro ou alternar o status entre ativa e pendente.

Ficha da cliente

A aplicação possui uma página específica para apresentação das informações individuais da cliente.

Abas da ficha

As informações da ficha são organizadas em abas. Ao selecionar uma aba, o conteúdo correspondente é apresentado sem necessidade de recarregar a página.

Dados da gestação

A aba Gestação permite registrar e editar, para cada cliente, a data da última menstruação, a data prevista do parto, o tipo de parto desejado, as informações do bebê (nome, sexo e movimentações) e as observações.

A idade gestacional é calculada automaticamente a partir da DUM, e a data prevista do parto é preenchida com DUM + 280 dias quando a DUM é informada. Os dados ficam gravados no cadastro da cliente, no armazenamento local do navegador.

Edição dos dados da ficha

O botão Editar dados abre um modal com os campos da aba Dados Gerais (nome, CPF, data de nascimento, telefone, e-mail, endereço e serviço principal). Ao salvar, a atualização acontece nos dois lados da tela: no painel de dados e na coluna de identificação (nome, iniciais do avatar, telefone, e-mail, data de nascimento com a idade calculada e cidade), mantendo a ficha consistente.

A data de nascimento é gravada no formato ISO (AAAA-MM-DD) e a idade é calculada automaticamente a partir dela, sem digitação.

Agenda: visualizações Dia, Semana e Mês

A Agenda oferece três formas de visualização, alternadas por um seletor: Dia, Semana e Mês. A navegação avança e retrocede o período conforme a visualização ativa (um dia, sete dias ou um mês), e o botão Hoje retorna à data atual.

O período exibido é sempre calculado a partir da data do sistema, e não de uma data fixa na aplicação.

Novo agendamento

O botão Novo agendamento abre uma janela modal com o formulário de cadastro, com a data já preenchida com o dia atual. Após salvar, o agendamento é gravado, aparece no calendário e o sistema navega automaticamente para o período correspondente.

As listas de clientes e de serviços do formulário são carregadas do cadastro compartilhado, portanto acompanham o que estiver cadastrado nas demais telas.

Detalhes do agendamento

Ao clicar em um agendamento no calendário, é apresentado um modal com cliente, data, horário, serviço e observação registrada. As janelas podem ser fechadas pelo botão de fechar, pela tecla Esc ou clicando fora delas.

Persistência local dos dados

O cadastro de clientes, os agendamentos e os atendimentos registrados são armazenados no navegador por meio da API localStorage (Web Storage). Um mesmo registro de clientes é compartilhado pelas telas de Clientes, Ficha, Serviços e Pendências, de modo que uma alteração feita em uma tela é refletida nas demais. Assim, os dados permanecem disponíveis após recarregar ou fechar a página, sem necessidade de servidor ou banco de dados nesta etapa do projeto.

As operações de leitura e gravação são protegidas por tratamento de erro, de modo que a aplicação continua funcionando mesmo quando o navegador bloqueia o armazenamento local — nesse caso, o usuário é avisado por meio de uma mensagem na tela.

Serviços

A tela de Serviços permite cadastrar e editar serviços por modal. O botão Ver clientes encaminha para a tela de Clientes com o filtro do serviço já aplicado.

Atendimento

A tela de Atendimento permite registrar anotações, informações do bebê, exames solicitados e o estado emocional da cliente. Os exames são adicionados e removidos como chips, e o registro é salvo no armazenamento local do navegador.

O atendimento é sempre aberto no nome da cliente selecionada na ficha, e o botão Cancelar retorna para essa mesma ficha.

O atendimento salvo passa a integrar a aba Atendimentos da ficha da cliente, que é montada a partir dos registros gravados. A aba Exames reúne os exames solicitados nesses atendimentos, e o menu de ações de cada atendimento exibe as anotações completas.

Contratos

A tela de Contratos permite visualizar a minuta do contrato de cada cliente e registrar a assinatura, atualizando o status na tabela e os totais apresentados no topo da página.

A aba Contratos da ficha também permite abrir a minuta e assinar o contrato daquela cliente diretamente, sem passar pela tela de Contratos. A ação grava o mesmo registro, de modo que as duas telas permanecem sincronizadas.

O status da assinatura é gravado no navegador e é a fonte da verdade ao abrir a tela: os totais do topo são calculados a partir das linhas da tabela, e a aba Contratos da ficha de cada cliente reflete a mesma informação.

Pendências

O menu de ações de cada linha permite abrir a ficha da cliente ou marcar a pendência como resolvida, removendo-a da lista e atualizando o contador.

Relatórios

O seletor de período atualiza os indicadores apresentados na tela.

Resumo inteligente

O componente de Resumo Inteligente está presente no Dashboard, na Ficha da cliente, no Atendimento e nos Relatórios.

Ao selecionar a opção correspondente, o sistema apresenta uma simulação de processamento e posteriormente exibe os pontos identificados para atenção. O resultado pode ser copiado para a área de transferência.

Essa funcionalidade foi implementada como uma interação de interface, servindo como representação da funcionalidade de apoio inteligente prevista no projeto.

Observação: nesta versão, o Resumo Inteligente é uma simulação de interface. Não existe, ainda, uma integração com uma API externa de inteligência artificial.

Modal genérico de ações

As ações que exigem confirmação ou preenchimento — cadastro e edição de clientes, cadastro e edição de serviços, filtros, minuta de contrato, ações das pendências e detalhes do agendamento — utilizam um único componente de modal, reaproveitado em todas as páginas.

O componente recebe título, conteúdo e ações, o que evita a duplicação de marcação e mantém o comportamento consistente em toda a aplicação. Os campos do formulário são gerados a partir de uma descrição simples, permitindo que a mesma estrutura atenda diferentes telas.

⸻

7. Responsividade

A interface foi adaptada para diferentes tamanhos de tela.

No Dashboard, por exemplo, os três cards de indicadores são reorganizados verticalmente em telas menores.

A área principal do Dashboard também passa de duas colunas para uma coluna quando a largura da tela é reduzida.

Na Agenda, a visualização Semana reduz a altura das células em telas menores e a visualização Dia passa a ocupar uma única coluna. Os modais também se ajustam à largura da tela.

A responsividade foi implementada utilizando regras CSS com @media queries, além dos recursos de CSS Grid e Flexbox.

O objetivo é permitir que a aplicação possa ser utilizada tanto em computadores quanto em dispositivos com telas menores.

⸻

8. Usabilidade e acessibilidade

Durante a implementação foram consideradas boas práticas de usabilidade e acessibilidade, incluindo:

* organização hierárquica das informações;
* utilização de textos claros nos menus e botões;
* contraste entre textos e fundos;
* áreas de clique adequadas;
* organização consistente dos componentes;
* utilização de ícones associados às opções de navegação;
* adaptação da interface para diferentes tamanhos de tela;
* organização das informações em cards, tabelas e abas;
* utilização de atributos ARIA nas janelas modais (role="dialog", aria-modal e rótulo associado);
* regiões de aviso com aria-live, para que o retorno das ações seja anunciado por leitores de tela;
* possibilidade de fechar as janelas pela tecla Esc, pelo botão de fechar ou clicando fora delas;
* foco levado ao primeiro campo ao abrir um modal e devolvido ao elemento de origem ao fechar;
* mensagem de estado vazio nas listas quando não há resultados.

A estrutura semântica do HTML também foi utilizada para facilitar a organização e futura evolução da acessibilidade da aplicação.

⸻

9. Decisões de implementação

A aplicação foi estruturada utilizando HTML, CSS e JavaScript, mantendo separadas as responsabilidades de estrutura, apresentação visual e comportamento.

O HTML é responsável pela estrutura das páginas.

O CSS concentra a identidade visual e as regras de layout, evitando a repetição desnecessária de estilos e permitindo a implementação da responsividade.

O JavaScript concentra as interações da aplicação, como:

* pesquisa e filtro da tabela de clientes;
* cadastro, edição e ações das linhas;
* funcionamento das abas;
* edição dos dados da ficha;
* registro de atendimento e manipulação dos exames;
* contratos e pendências;
* filtro de período dos relatórios;
* interação do resumo inteligente e cópia do resultado;
* calendário da Agenda, com as visualizações Dia, Semana e Mês;
* modal genérico de ações;
* persistência local dos dados.

Todas as interações estão em um único arquivo (assets/app.js), organizado em blocos comentados. Um mesmo arquivo é carregado por todas as páginas, e cada bloco verifica a existência dos elementos antes de executar. Isso evita scripts duplicados e mantém um único ponto de manutenção.

As ações que se repetem em várias linhas de tabela são tratadas por um único listener ligado a cada elemento, evitando a duplicação de código e garantindo que as linhas criadas dinamicamente também respondam às ações.

O armazenamento local é acessado com tratamento de erro, para que a aplicação não interrompa o funcionamento caso o navegador bloqueie o localStorage.

Também foram utilizadas classes reutilizáveis para componentes como cards, botões, campos de formulário, tabelas e elementos de navegação.

A utilização de CSS Grid e Flexbox permitiu organizar os elementos da interface de maneira flexível, enquanto as @media queries possibilitaram a adaptação dos layouts para telas menores.

A escolha por JavaScript puro, sem framework de frontend, foi realizada considerando o escopo atual da aplicação e a necessidade de manter uma estrutura simples e compreensível durante a etapa de implementação.

⸻

10. Execução da aplicação

Por se tratar de uma aplicação web baseada em arquivos HTML, CSS e JavaScript, a interface pode ser executada localmente utilizando um navegador.

Opção 1 — Abrir diretamente

Abra o arquivo:

index.html

ou:

login.html

em um navegador compatível.

Observação: alguns navegadores restringem o armazenamento local quando o arquivo é aberto diretamente pelo protocolo file://. Para que a persistência dos agendamentos e atendimentos funcione, recomenda-se utilizar a Opção 2.

Opção 2 — Utilizar o Visual Studio Code

Recomenda-se utilizar o Visual Studio Code com uma extensão de servidor local, como o Live Server, para executar a aplicação durante o desenvolvimento.

Após iniciar o servidor local, abra a página inicial da aplicação no navegador.

⸻

11. Evidências do funcionamento

As versões 2.0 e 2.1 do projeto devem ser acompanhadas por capturas de tela que demonstrem o funcionamento da interface.

As principais evidências incluem:

1. Tela de Login;
2. Dashboard;
3. Dashboard em resolução menor;
4. Tela de Agenda;
5. Modal de Novo Agendamento;
6. Tela de Clientes;
7. Pesquisa de cliente;
8. Ficha da Cliente;
9. Navegação entre abas da ficha;
10. Tela de Atendimento;
11. Tela de Contratos;
12. Resumo Inteligente funcionando;
13. Agenda na visualização Semana;
14. Modal de Detalhes do agendamento;
15. Tela de Serviços;
16. Tela de Relatórios;
17. Tela de Pendências;
18. Modal genérico de ações (cadastro de cliente).

As capturas devem ser adicionadas ao Documento Técnico da Versão 2.0 para comprovar a implementação das funcionalidades.

⸻

12. Histórico de versões

Versão	Etapa	Alterações
1.0	TED 01	Definição do problema, levantamento inicial, definição do conjunto de dados e planejamento do projeto.
2.0	TED 02	Implementação da interface, criação das principais telas, navegação, busca de clientes, abas da ficha, Novo Agendamento, Resumo Inteligente, responsividade e organização visual da aplicação.
2.1	TED 02	Consolidação do CSS e do JavaScript em arquivos únicos, Agenda com visualizações Dia/Semana/Mês e detalhes do agendamento, persistência local dos dados, telas de Serviços, Relatórios e Pendências, modal genérico de ações e ações de cadastro, edição e assinatura.

⸻

13. Status do projeto

TED 01

* [x]	Definição do problema
* [x]	Identificação do conjunto de dados
* [x]	Planejamento inicial do projeto

TED 02

* [x]	Estrutura inicial da aplicação
* [x]	Implementação das principais telas
* [x]	Identidade visual
* [x]	Dashboard
* [x]	Agenda
* [x]	Clientes
* [x]	Ficha da cliente
* [x]	Atendimento
* [x]	Contratos
* [x]	Busca de clientes
* [x]	Abas da ficha
* [x]	Novo Agendamento
* [x]	Resumo Inteligente
* [x]	Responsividade inicial
* [x]	Agenda com visualizações Dia, Semana e Mês
* [x]	Detalhes do agendamento
* [x]	Cadastro e edição de clientes
* [x]	Filtro de clientes por status
* [x]	Edição dos dados da ficha
* [x]	Registro de atendimento
* [x]	Contratos e assinatura
* [x]	Serviços
* [x]	Relatórios
* [x]	Pendências
* [x]	Persistência local dos dados
* [x]	Ficha da cliente aberta a partir da cliente selecionada
* [x]	Dados da gestação editáveis por cliente, com cálculo de DPP e idade gestacional
* [x]	Atendimentos salvos aparecem na ficha, com exames e detalhes
* [x]	Status dos contratos persistido e refletido na ficha
* [x]	Assinatura de contrato a partir da ficha da cliente
* [x]	Data de nascimento em todos os cadastros, com idade calculada
* [x]	Sincronia entre a coluna de identificação e o painel de dados
* [x]	Modal genérico de ações
* [x]	README atualizado

⸻

14. Publicação da aplicação

 Ainda em preparaçao 

⸻

15. Considerações finais

A Versão 2.0 representa a etapa de implementação da interface planejada anteriormente.

A aplicação passou a contar com uma estrutura navegável e com componentes interativos para apoiar a rotina de gerenciamento do Instituto Lírios.

A implementação foi realizada utilizando HTML5, CSS3 e JavaScript puro, sem a utilização de frameworks de frontend. Foram utilizados recursos nativos como CSS Grid, Flexbox e media queries para organização e responsividade da interface.

16. Banco de dados

O modelo de dados do sistema foi projetado e está disponível na pasta db/, em MySQL 8. Ele é composto por nove tabelas — usuarios, servicos, clientes, gestacoes, atendimentos, atendimento_exames, contratos, agendamentos e pendencias — além de três views de apoio e índices para as consultas mais frequentes.

O modelo contempla chaves estrangeiras com regras de exclusão adequadas a cada relação, restrições de integridade (CHECK e ENUM) para as regras de negócio e tipos de dados compatíveis com os dados manipulados pela interface.

Os scripts schema.sql e seed.sql criam e populam o banco, e o arquivo consultas.sql reúne as consultas utilizadas por cada tela. O script validar.py executa o modelo e confere estrutura, dados, restrições e consultas.

16.1 API

Sobre o banco foi construída uma API REST em Node.js com Express e mysql2, na pasta server/. Ela expõe endpoints para clientes, gestações, atendimentos, contratos, agenda, pendências, serviços e indicadores do dashboard, além da validação de login.

A API concentra a validação de entrada, executa as gravações que envolvem mais de uma tabela dentro de transações e traduz os erros do banco em respostas HTTP adequadas (400 para dado inválido, 404 para registro inexistente, 409 para duplicidade ou registro em uso e 503 para banco indisponível).

Para executar: importar o banco, rodar npm install e npm start dentro de server/, conforme o README daquela pasta.

16.2 Interface conectada à API

A interface passou a consumir a API por meio do arquivo assets/banco.js, que concentra o acesso aos dados. Ao abrir qualquer página, esse arquivo consulta o endpoint /api/health:

* se a API responder, os dados são lidos do MySQL e todas as gravações são enviadas por requisições HTTP (POST, PATCH, PUT e DELETE);
* se a API não responder, a aplicação continua funcionando com os dados do armazenamento local do navegador.

Esse comportamento garante que a apresentação do projeto funcione mesmo sem o servidor ligado, sem perder a integração com o banco quando ele está disponível.

As telas de Clientes, Ficha da cliente, Atendimento, Contratos, Agenda, Pendências, Serviços, Login e Dashboard já utilizam essa camada. A tela de Relatórios ainda apresenta dados estáticos.

O cadastro de clientes, os agendamentos, os atendimentos e o status dos contratos são armazenados localmente no navegador, o que permite demonstrar o funcionamento das telas sem uma camada de servidor. A próxima etapa do projeto poderá substituir esse armazenamento por uma API e um banco de dados, mantendo a estrutura de páginas e componentes já implementada.

As próximas etapas do projeto poderão ampliar as funcionalidades implementadas, integrar a aplicação a uma camada de backend e banco de dados e aprimorar os recursos de análise e apoio à tomada de decisão.