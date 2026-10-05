# Sistema de Gestão para o Instituto Lírios

TED 01 – Big Data e Ciência de Dados: Definição do Problema de Dados e Seleção do Conjunto de Dados

## Integrantes
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
* Google Fonts — utilizadas as famílias tipográficas Cormorant Garamond e Manrope.

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
│   ├── style.css
│   └── app.js
│
├── dashboard.html
├── agenda.html
├── clientes.html
├── ficha-cliente.html
├── atendimento.html
├── contratos.html
├── login.html
├── index.html
├── data/
│   └── Maternal_Health_Risk_Data_Set.csv
└── README.md

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

Página destinada ao acompanhamento dos contratos das clientes.

login.html

Tela de acesso inicial ao sistema.

assets/style.css

Arquivo responsável pela identidade visual, layout, componentes, cards, tabelas, formulários, responsividade e demais estilos da aplicação.

assets/app.js

Arquivo responsável pelas principais interações da interface, incluindo pesquisa de clientes, navegação entre abas e funcionamento do resumo inteligente.

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

A tela de Agenda permite visualizar os compromissos e horários cadastrados.

Também foi implementada a interação de Novo Agendamento, apresentada por meio de uma janela modal.

5.4 Clientes

A tela de Clientes apresenta os registros das clientes e possui um campo de pesquisa.

A pesquisa é realizada de forma dinâmica utilizando JavaScript, permitindo localizar clientes pelo nome.

5.5 Ficha da cliente

A Ficha da Cliente apresenta informações detalhadas da cliente.

A interface utiliza abas para organizar os diferentes grupos de informações, permitindo alternar entre os conteúdos sem sair da página.

5.6 Atendimento

A tela de Atendimento foi estruturada para apoiar o registro das informações relacionadas aos atendimentos realizados.

5.7 Contratos

A tela de Contratos foi desenvolvida para organizar e acompanhar as informações relacionadas aos contratos das clientes.

⸻

6. Funcionalidades implementadas

Durante a implementação da interface foram desenvolvidas e testadas as seguintes funcionalidades:

Pesquisa de clientes

O usuário pode digitar um nome no campo de pesquisa e a tabela é filtrada dinamicamente para apresentar os resultados correspondentes.

Essa funcionalidade é implementada por meio de JavaScript, utilizando eventos de entrada no campo de pesquisa e manipulação dos elementos da tabela.

Ficha da cliente

A aplicação possui uma página específica para apresentação das informações individuais da cliente.

Abas da ficha

As informações da ficha são organizadas em abas. Ao selecionar uma aba, o conteúdo correspondente é apresentado sem necessidade de recarregar a página.

Novo agendamento

A Agenda possui uma interação para abertura da janela de Novo Agendamento, permitindo visualizar o formulário correspondente.

Resumo inteligente

O Dashboard possui o componente de Resumo Inteligente.

Ao selecionar a opção correspondente, o sistema apresenta uma simulação de processamento e posteriormente exibe os pontos identificados para atenção.

Essa funcionalidade foi implementada como uma interação de interface, servindo como representação da funcionalidade de apoio inteligente prevista no projeto.

Observação: nesta versão, o Resumo Inteligente é uma simulação de interface. Não existe, ainda, uma integração com uma API externa de inteligência artificial.

⸻

7. Responsividade

A interface foi adaptada para diferentes tamanhos de tela.

No Dashboard, por exemplo, os três cards de indicadores são reorganizados verticalmente em telas menores.

A área principal do Dashboard também passa de duas colunas para uma coluna quando a largura da tela é reduzida.

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
* organização das informações em cards, tabelas e abas.

A estrutura semântica do HTML também foi utilizada para facilitar a organização e futura evolução da acessibilidade da aplicação.

⸻

9. Decisões de implementação

A aplicação foi estruturada utilizando HTML, CSS e JavaScript, mantendo separadas as responsabilidades de estrutura, apresentação visual e comportamento.

O HTML é responsável pela estrutura das páginas.

O CSS concentra a identidade visual e as regras de layout, evitando a repetição desnecessária de estilos e permitindo a implementação da responsividade.

O JavaScript concentra as interações da aplicação, como:

* filtro da tabela de clientes;
* funcionamento das abas;
* interação do resumo inteligente.

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

Opção 2 — Utilizar o Visual Studio Code

Recomenda-se utilizar o Visual Studio Code com uma extensão de servidor local, como o Live Server, para executar a aplicação durante o desenvolvimento.

Após iniciar o servidor local, abra a página inicial da aplicação no navegador.

⸻

11. Evidências do funcionamento

A Versão 2.0 do projeto deve ser acompanhada por capturas de tela que demonstrem o funcionamento da interface.

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
12. Resumo Inteligente funcionando.

As capturas devem ser adicionadas ao Documento Técnico da Versão 2.0 para comprovar a implementação das funcionalidades.

⸻

12. Histórico de versões

Versão	Etapa	Alterações
1.0	TED 01	Definição do problema, levantamento inicial, definição do conjunto de dados e planejamento do projeto.
2.0	TED 02	Implementação da interface, criação das principais telas, navegação, busca de clientes, abas da ficha, Novo Agendamento, Resumo Inteligente, responsividade e organização visual da aplicação.

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
* [x]	README atualizado

⸻

14. Publicação da aplicação

Ainda em andamento 
⸻

15. Considerações finais

A Versão 2.0 representa a etapa de implementação da interface planejada anteriormente.

A aplicação passou a contar com uma estrutura navegável e com componentes interativos para apoiar a rotina de gerenciamento do Instituto Lírios.

A implementação foi realizada utilizando HTML5, CSS3 e JavaScript puro, sem a utilização de frameworks de frontend. Foram utilizados recursos nativos como CSS Grid, Flexbox e media queries para organização e responsividade da interface.

As próximas etapas do projeto poderão ampliar as funcionalidades implementadas, integrar a aplicação a uma camada de backend e banco de dados e aprimorar os recursos de análise e apoio à tomada de decisão.
- Erika Vitoria Da Cruz Silva
- Kelry Silva De Sousa
- Victorya Lima Souza
- Pedro Rusvel Pinheiro Siqueira De Carvalho

## Descrição do problema

O Instituto Lírios atua no atendimento materno-infantil e em outros serviços de cuidados em saúde, mas não possui um sistema próprio para concentrar e organizar suas informações. A responsável utiliza ferramentas separadas, como WhatsApp, documentos do Word, pastas e Google Agenda, para registrar e consultar dados das clientes, atendimentos, contratos, agendamentos e pendências. Esse controle manual dificulta o gerenciamento das atividades e a localização de informações do histórico de atendimento.

O problema identificado é a ausência de um sistema centralizado para organizar os dados das clientes e apoiar o acompanhamento dos atendimentos realizados pelo Instituto.

## Conjunto de dados utilizado

- **Nome da base:** Maternal Health Risk
- **Identificação:** ID 863 no UCI Machine Learning Repository (DOI: https://doi.org/10.24432/C5DP5D)
- **Arquivo:** `Maternal_Health_Risk_Data_Set.csv` (formato CSV; 1.013 registros segundo a documentação da UCI, e o arquivo baixado contém 1.014 linhas de dados)
- **Fonte dos dados:** UCI Machine Learning Repository
- **Origem:** hospitais, clínicas comunitárias e serviços de saúde materna de áreas rurais de Bangladesh
- **Link para a fonte original:** https://archive.ics.uci.edu/dataset/863/maternal+health+risk
- **Licença:** Creative Commons Attribution 4.0 International (CC BY 4.0)

O arquivo está na pasta `data/` deste repositório. Caso ele não esteja disponível, acesse o link da fonte original, clique em **Download** e salve o arquivo CSV na pasta `data/`.
