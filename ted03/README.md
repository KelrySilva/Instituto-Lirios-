# Instituto Lírios — Big Data e Ciência de Dados

Projeto acadêmico da disciplina **Big Data e Ciência de Dados** (Análise e Desenvolvimento de Sistemas),
com foco no problema de gestão de informações do **Instituto Lírios** e no uso da base pública
**Maternal Health Risk** (UCI Machine Learning Repository) como apoio às etapas de análise.

## Integrantes

- Erika Vitoria Da Cruz Silva
- Kelry Silva De Sousa
- Victorya Lima Souza
- Pedro Rusvel Pinheiro Siqueira De Carvalho

Docente: Prof. Alex Rogaleski Marques

## Etapas do projeto

| Etapa | Conteúdo | Documento |
|-------|----------|-----------|
| TED 01 | Definição do problema, necessidades de dados e seleção da base | `docs/TED01.pdf` |
| TED 02 | Limpeza, saneamento e análise exploratória (1.014 → 448 registros únicos) | `docs/TED02.pdf` |
| TED 03 | Modelagem preditiva, avaliação e interpretação dos resultados | `docs/Instituto_Lirios_TED03_Documento_Tecnico_v3.docx` |

## Base de dados

- **Fonte:** Maternal Health Risk, UCI Machine Learning Repository — DOI [10.24432/C5DP5D]( https://doi.org/10.24432/C5DP5D )
- **Arquivo bruto:** `data/raw/Maternal Health Risk Data Set.csv` (1.014 registros, 7 colunas)
- **Arquivo tratado:** `data/processed/maternal_health_risk_clean.csv` (448 registros únicos)

Variáveis: `Age`, `SystolicBP`, `DiastolicBP`, `BS`, `BodyTemp`, `HeartRate` e o alvo `RiskLevel`
(low / mid / high risk).

## Estrutura do repositório

```
projeto/
├── README.md
├── requirements.txt
├── docs/                       # documentos técnicos de cada etapa
├── data/
│   ├── raw/                    # base original, sem alterações
│   └── processed/              # base tratada
├── scripts/
│   ├── gerar_documento_v3.py   # gera o documento da TED 03 (.docx)
│   └── ted03_modelagem.py      # limpeza + modelagem + avaliação + figuras
├── figures/                    # figuras 01 a 14 usadas no documento
└── results/                    # métricas em CSV e resumo.json
```

## Como executar

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python scripts/ted03_modelagem.py
```

O script:

1. carrega a base bruta e reaplica exatamente os tratamentos da TED 02;
2. compara seis modelos (baseline, regressão logística, árvore, Random Forest, Gradient Boosting e SVM);
3. repete a comparação na Base bruta para evidenciar o vazamento causado por duplicatas;
4. ajusta hiperparâmetros do Random Forest por busca em grade;
5. avalia no holdout estratificado 70/30;
6. executa o experimento binário (high risk vs. demais) com curvas ROC;
7. grava as figuras em `figures/` e as tabelas em `results/`.

Tempo de execução: cerca de 2 minutos. Semente fixa (`SEED = 42`) — os números são reprodutíveis.

## Principais resultados (TED 03)

| Modelo | Acurácia (teste) | F1-macro (teste) |
|--------|------------------|------------------|
| Baseline (classe majoritária) | 0,511 | 0,225 |
| Random Forest (ajustado) | 0,704 | 0,614 |
| SVM (RBF) | 0,719 | 0,637 |

Tarefa binária (high risk vs. demais): AUC de 0,950 com o Random Forest.

As variáveis mais relevantes são **BS (glicemia)** e **SystolicBP**; a classe `mid risk` é a mais difícil
(F1 = 0,255), e 87,5% dos erros ocorrem entre níveis vizinhos da escala ordinal.

## Aviso

O modelo é um exercício acadêmico de modelagem. Não constitui ferramenta de diagnóstico, não foi validado
para a população atendida pelo Instituto Lírios e não deve ser usado para decisões clínicas.
