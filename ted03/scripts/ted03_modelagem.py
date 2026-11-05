"""
TED 03 - Modelagem Preditiva e Machine Learning
Projeto: Instituto Lirios
Disciplina: Big Data e Ciencia de Dados
Base de dados: Maternal Health Risk (UCI Machine Learning Repository)

Objetivo
--------
Treinar e avaliar modelos de classificacao capazes de prever o nivel de risco
gestacional (RiskLevel: low / mid / high risk) a partir de seis sinais vitais
(Age, SystolicBP, DiastolicBP, BS, BodyTemp, HeartRate).

O script reproduz, em sequencia:
 1. carga da base bruta e aplicacao dos mesmos tratamentos da TED 02;
 2. definicao dos cenarios de avaliacao (com e sem deduplicacao previa);
 3. comparacao de modelos por validacao cruzada repetida (5 folds x 3 repeticoes);
 4. busca de hiperparametros do Random Forest;
 5. avaliacao final em conjunto de teste reservado (holdout 70/30);
 6. metricas por classe, matriz de confusao e importancias das variaveis;
 7. experimento auxiliar binario (high risk vs. nao high risk) com curvas ROC;
 8. curva de aprendizado para diagnostico de sobreajuste;
 9. gravacao de tabelas (results/) e figuras (figures/).

Saidas
------
data/processed/maternal_health_risk_clean.csv
figures/08_*.png ... 14_*.png
results/*.csv  e  results/resumo.json
"""

from __future__ import annotations

import json
import os
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (
    GridSearchCV,
    RepeatedStratifiedKFold,
    StratifiedKFold,
    cross_validate,
    learning_curve,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, label_binarize
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# CAMINHOS E CONFIGURACOES GERAIS
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
RAW_PATH = BASE_DIR / "data/raw/Maternal Health Risk Data Set.csv"
CLEAN_PATH = BASE_DIR / "data/processed/maternal_health_risk_clean.csv"
FIG_DIR = BASE_DIR / "figures"
RES_DIR = BASE_DIR / "results"

for d in (FIG_DIR, RES_DIR, CLEAN_PATH.parent):
    os.makedirs(d, exist_ok=True)

sns.set_style("whitegrid")
plt.rcParams["figure.dpi"] = 150
plt.rcParams["font.size"] = 9

SEED = 42
TARGET = "RiskLevel"
FEATURES = ["Age", "SystolicBP", "DiastolicBP", "BS", "BodyTemp", "HeartRate"]
CLASSES = ["low risk", "mid risk", "high risk"]
PALETTE = {"low risk": "#8fbf7f", "mid risk": "#f2c14e", "high risk": "#d1495b"}

# ---------------------------------------------------------------------------
# 1. CARGA E TRATAMENTO (identico a TED 02)
# ---------------------------------------------------------------------------
def load_raw() -> pd.DataFrame:
    df = pd.read_csv(RAW_PATH)
    print(f"Base bruta: {df.shape[0]} registros, {df.shape[1]} colunas")
    print("Valores ausentes:", int(df.isna().sum().sum()))
    print("Duplicatas exatas:", int(df.duplicated().sum()))
    return df


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica os tratamentos justificados na Secao 8 do Documento Tecnico v2.0."""
    n0 = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    n1 = len(df)
    df = df[df["HeartRate"] != 7].reset_index(drop=True)
    n2 = len(df)
    df = df[df["Age"] >= 12].reset_index(drop=True)
    n3 = len(df)
    df[TARGET] = pd.Categorical(df[TARGET], categories=CLASSES, ordered=True)
    print(f"Limpeza: {n0} -> {n1} (duplicatas) -> {n2} (HeartRate=7) -> {n3} (Age<12)")
    return df


# ---------------------------------------------------------------------------
# 2. MODELOS CANDIDATOS
# ---------------------------------------------------------------------------
def build_models() -> dict:
    """Modelos comparados, com hiperparametros fixos em valores usuais.

    A padronizacao (StandardScaler) e aplicada dentro de um Pipeline apenas nos
    modelos sensiveis a escala (regressao logistica e SVM), sempre ajustada
    dentro de cada fold de treino, evitando vazamento de informacao do teste.
    """
    return {
        "Baseline (classe majoritaria)": DummyClassifier(strategy="most_frequent"),
        "Regressao Logistica": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=5000, class_weight="balanced",
                                       random_state=SEED)),
        ]),
        "Arvore de Decisao": DecisionTreeClassifier(
            max_depth=5, min_samples_leaf=5, class_weight="balanced", random_state=SEED),
        "Random Forest": RandomForestClassifier(
            n_estimators=400, min_samples_leaf=2, class_weight="balanced_subsample",
            random_state=SEED, n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=200, learning_rate=0.05, max_depth=3, random_state=SEED),
        "SVM (RBF)": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", SVC(kernel="rbf", C=1.0, gamma="scale", class_weight="balanced",
                        probability=True, random_state=SEED)),
        ]),
    }


METRICS = {
    "accuracy": "accuracy",
    "balanced_accuracy": "balanced_accuracy",
    "f1_macro": "f1_macro",
    "f1_weighted": "f1_weighted",
}


def cross_validate_models(df: pd.DataFrame, cv, label: str) -> pd.DataFrame:
    """Valida todos os modelos com o mesmo esquema de validacao cruzada."""
    X, y = df[FEATURES], df[TARGET].astype(str)
    rows = []
    for name, model in build_models().items():
        scores = cross_validate(model, X, y, cv=cv, scoring=METRICS,
                                n_jobs=-1, error_score="raise")
        row = {"modelo": name, "cenario": label}
        for metric in METRICS:
            row[f"{metric}_media"] = scores[f"test_{metric}"].mean()
            row[f"{metric}_desvio"] = scores[f"test_{metric}"].std()
        rows.append(row)
        print(f"  [{label}] {name:<32} acc={row['accuracy_media']:.3f}  "
              f"f1_macro={row['f1_macro_media']:.3f} (+-{row['f1_macro_desvio']:.3f})")
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 3. GRAFICOS
# ---------------------------------------------------------------------------
def plot_model_comparison(cv_df: pd.DataFrame, path: Path) -> None:
    """Barras horizontais com F1-macro medio e desvio entre repeticoes."""
    order = cv_df.sort_values("f1_macro_media").reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    colors = ["#b08968" if m.startswith("Baseline") else "#7a5c46" for m in order["modelo"]]
    ax.barh(order["modelo"], order["f1_macro_media"], xerr=order["f1_macro_desvio"],
            color=colors, capsize=3)
    for i, (v, s) in enumerate(zip(order["f1_macro_media"], order["f1_macro_desvio"])):
        ax.text(v + s + 0.03, i, f"{v:.3f}", va="center", fontsize=8)
    ax.set_xlim(0, 0.90)
    ax.set_xlabel("F1-score macro (média ± desvio, validação cruzada 5×3)")
    ax.set_title("Comparação dos modelos — base tratada (n = 448)")
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


def plot_leakage_comparison(bruta: pd.DataFrame, tratada: pd.DataFrame, path: Path) -> None:
    """Efeito de manter duplicatas na avaliacao (vazamento treino/teste)."""
    model_names = bruta["modelo"].tolist()
    x = np.arange(len(model_names))
    width = 0.38
    fig, ax = plt.subplots(figsize=(7.6, 3.8))
    ax.bar(x - width / 2, bruta["f1_macro_media"], width, label="Base bruta (1.014, com duplicatas)",
           color="#d1495b")
    ax.bar(x + width / 2, tratada["f1_macro_media"], width, label="Base tratada (448, sem duplicatas)",
           color="#8fbf7f")
    ax.set_xticks(x)
    ax.set_xticklabels([m.replace(" (classe majoritaria)", "\n(classe majoritária)") for m in model_names],
                       rotation=18, ha="right", fontsize=8)
    ax.set_ylim(0, 1)
    for i, (b, t) in enumerate(zip(bruta["f1_macro_media"], tratada["f1_macro_media"])):
        ax.text(i - width / 2, b + 0.02, f"{b:.2f}", ha="center", fontsize=7)
        ax.text(i + width / 2, t + 0.02, f"{t:.2f}", ha="center", fontsize=7)
    ax.set_ylabel("F1-score macro (média CV)")
    ax.set_title("Efeito de manter registros duplicados na avaliação")
    ax.legend(fontsize=8)
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


def plot_confusion(y_true, y_pred, path: Path) -> None:
    """Matriz de confusao em contagens e em proporcao por classe real."""
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES)
    cm_norm = cm / cm.sum(axis=1, keepdims=True)
    fig, axes = plt.subplots(1, 2, figsize=(9.4, 4.0))
    for ax, data, title, fmt in (
        (axes[0], cm, "Contagens", "d"),
        (axes[1], cm_norm, "Proporção por classe real", ".2f"),
    ):
        sns.heatmap(data, annot=True, fmt=fmt, cmap="YlGnBu", cbar=False,
                    xticklabels=CLASSES, yticklabels=CLASSES, ax=ax)
        ax.set_title(title, fontsize=9)
        ax.set_xlabel("Previsto")
        ax.set_ylabel("Real")
    fig.suptitle("Matriz de confusão — Random Forest (conjunto de teste, 30%)", fontsize=10)
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


def plot_per_class(y_true, y_pred, path: Path) -> None:
    prec, rec, f1, sup = precision_recall_fscore_support(
        y_true, y_pred, labels=CLASSES, zero_division=0)
    frame = pd.DataFrame({"Precisão": prec, "Revocação": rec, "F1-score": f1}, index=CLASSES)
    ax = frame.plot.bar(figsize=(7.2, 3.6), color=["#7a5c46", "#c9a882", "#8fbf7f"],
                        edgecolor="white")
    for container in ax.containers:
        ax.bar_label(container, fmt="%.2f", fontsize=8, padding=2)
    ax.set_ylim(0, 1.08)
    ax.set_ylabel("Valor da métrica")
    ax.set_title("Métricas por classe — Random Forest (teste)\n"
                 f"suporte: low={sup[0]}, mid={sup[1]}, high={sup[2]}")
    ax.tick_params(axis="x", rotation=0)
    ax.legend(fontsize=8, ncol=3, loc="lower right")
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


def plot_importance(rf: RandomForestClassifier, X_test, y_test, path: Path) -> pd.DataFrame:
    """Importancia por impureza (Gini) e por permutacao no conjunto de teste."""
    gini = pd.Series(rf.feature_importances_, index=FEATURES)
    perm = permutation_importance(rf, X_test, y_test, n_repeats=30,
                                  random_state=SEED, scoring="f1_macro", n_jobs=-1)
    perm_series = pd.Series(perm.importances_mean, index=FEATURES)
    frame = pd.DataFrame({"Impureza (Gini)": gini, "Permutação": perm_series})
    frame = frame / frame.max()
    frame = frame.sort_values("Permutação")
    ax = frame.plot.barh(figsize=(7.2, 3.4), color=["#c9a882", "#7a5c46"])
    ax.axvline(0, color="black", linewidth=0.7)
    ax.set_xlabel("Importância relativa (normalizada; valores negativos = sem ganho)")
    ax.set_title("Importância das variáveis — Random Forest (permutação no teste)")
    ax.legend(fontsize=8)
    plt.tight_layout()
    plt.savefig(path)
    plt.close()
    return pd.DataFrame({"variavel": FEATURES, "gini": gini, "permutacao": perm_series})


def plot_learning_curve(model, X, y, path: Path) -> None:
    """Curva de aprendizado: desempenho de treino x validacao por tamanho amostral."""
    sizes, train_scores, test_scores = learning_curve(
        clone(model), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=SEED),
        scoring="f1_macro", train_sizes=np.linspace(0.2, 1.0, 6), n_jobs=-1)
    train_mean, train_std = train_scores.mean(1), train_scores.std(1)
    test_mean, test_std = test_scores.mean(1), test_scores.std(1)
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.plot(sizes, train_mean, "o-", color="#d1495b", label="Treino")
    ax.fill_between(sizes, train_mean - train_std, train_mean + train_std, alpha=0.15, color="#d1495b")
    ax.plot(sizes, test_mean, "o-", color="#4a7c59", label="Validação cruzada")
    ax.fill_between(sizes, test_mean - test_std, test_mean + test_std, alpha=0.15, color="#4a7c59")
    ax.set_xlabel("Número de amostras de treinamento")
    ax.set_ylabel("F1-score macro")
    ax.set_ylim(0.3, 1.02)
    ax.set_title("Curva de aprendizado — Random Forest")
    ax.legend(fontsize=8)
    plt.tight_layout()
    plt.savefig(path)
    plt.close()
    return sizes, train_mean, test_mean


def plot_roc_binary(roc_data: dict, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(6.2, 4.4))
    for name, (fpr, tpr, auc_value) in roc_data.items():
        ax.plot(fpr, tpr, label=f"{name} (AUC = {auc_value:.3f})")
    ax.plot([0, 1], [0, 1], "--", color="grey", linewidth=0.9, label="Aleatório")
    ax.set_xlabel("Taxa de falsos positivos")
    ax.set_ylabel("Taxa de verdadeiros positivos (revocação)")
    ax.set_title("Curvas ROC — high risk vs. demais (teste)")
    ax.legend(fontsize=8, loc="lower right")
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


# ---------------------------------------------------------------------------
# 4. FLUXO PRINCIPAL
# ---------------------------------------------------------------------------
def main() -> None:
    print("=" * 74)
    print("1) CARGA E TRATAMENTO")
    print("=" * 74)
    raw = load_raw()
    clean = clean_dataset(raw.copy())
    clean.to_csv(CLEAN_PATH, index=False)
    print(f"Base tratada salva em: {CLEAN_PATH}")

    X = clean[FEATURES]
    y = clean[TARGET].astype(str)

    # ------------------------------------------------------------------
    # 2) CENARIOS E VALIDACAO CRUZADA
    # ------------------------------------------------------------------
    print("\n" + "=" * 74)
    print("2) COMPARACAO DE MODELOS (validacao cruzada repetida 5x3)")
    print("=" * 74)
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
    print("\nCenario A - base tratada (448 registros unicos):")
    cv_clean = cross_validate_models(clean, cv, "tratada")

    print("\nCenario B - base bruta (1.014 registros, com duplicatas):")
    raw_eval = raw.copy()
    raw_eval[TARGET] = raw_eval[TARGET].astype(str)
    cv_raw = cross_validate_models(raw_eval, cv, "bruta")

    cv_clean.to_csv(RES_DIR / "cv_base_tratada.csv", index=False)
    cv_raw.to_csv(RES_DIR / "cv_base_bruta.csv", index=False)
    plot_model_comparison(cv_clean, FIG_DIR / "08_comparacao_modelos.png")
    plot_leakage_comparison(cv_raw, cv_clean, FIG_DIR / "09_efeito_duplicatas.png")

    # ------------------------------------------------------------------
    # 3) BUSCA DE HIPERPARAMETROS (Random Forest)
    # ------------------------------------------------------------------
    print("\n" + "=" * 74)
    print("3) BUSCA DE HIPERPARAMETROS - Random Forest")
    print("=" * 74)
    grid = {
        "n_estimators": [200, 400],
        "max_depth": [None, 8, 12],
        "min_samples_leaf": [1, 2, 4],
        "max_features": ["sqrt", 0.5],
    }
    search = GridSearchCV(
        RandomForestClassifier(class_weight="balanced_subsample", random_state=SEED, n_jobs=-1),
        grid, scoring="f1_macro",
        cv=StratifiedKFold(5, shuffle=True, random_state=SEED), n_jobs=-1)
    search.fit(X, y)
    print("Melhores hiperparametros:", search.best_params_)
    print(f"Melhor F1-macro em CV: {search.best_score_:.3f}")
    best_rf = search.best_estimator_

    # ------------------------------------------------------------------
    # 4) HOLDOUT ESTRATIFICADO 70/30
    # ------------------------------------------------------------------
    print("\n" + "=" * 74)
    print("4) AVALIACAO FINAL - HOLDOUT 70/30 ESTRATIFICADO")
    print("=" * 74)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=SEED)
    print(f"Treino: {len(X_train)} | Teste: {len(X_test)}")
    print("Distribuicao no teste:", y_test.value_counts().to_dict())

    models = build_models()
    models["Random Forest (ajustado)"] = best_rf
    holdout_rows, fitted, reports = [], {}, {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        fitted[name] = model
        row = {
            "modelo": name,
            "acuracia": accuracy_score(y_test, pred),
            "acuracia_balanceada": balanced_accuracy_score(y_test, pred),
            "f1_macro": f1_score(y_test, pred, average="macro"),
            "f1_weighted": f1_score(y_test, pred, average="weighted"),
        }
        holdout_rows.append(row)
        reports[name] = classification_report(y_test, pred, labels=CLASSES, output_dict=True,
                                              zero_division=0)
        print(f"  {name:<32} acc={row['acuracia']:.3f}  f1_macro={row['f1_macro']:.3f}")

    holdout = pd.DataFrame(holdout_rows).sort_values("f1_macro", ascending=False)
    holdout.to_csv(RES_DIR / "holdout_metricas.csv", index=False)

    final_model = best_rf
    final_pred = final_model.predict(X_test)

    # Analise ordinal dos erros: a distância entre a classe real e a prevista e
    # relevante porque RiskLevel e uma escala ordenada (low < mid < high).
    rank = {c: i for i, c in enumerate(CLASSES)}
    distancia = np.abs(y_test.map(rank).to_numpy() - pd.Series(final_pred).map(rank).to_numpy())
    erros = distancia > 0
    ordinal = {
        "erros_total": int(erros.sum()),
        "erros_adjacentes": int((distancia == 1).sum()),
        "erros_distantes": int((distancia == 2).sum()),
        "pct_erros_adjacentes": float((distancia == 1).sum() / max(erros.sum(), 1)),
        "distancia_media_absoluta": float(distancia.mean()),
    }
    print(f"Erros ordinais: {ordinal}")

    plot_confusion(y_test, final_pred, FIG_DIR / "10_matriz_confusao.png")
    plot_per_class(y_test, final_pred, FIG_DIR / "11_metricas_por_classe.png")
    importance = plot_importance(final_model, X_test, y_test, FIG_DIR / "12_importancia_variaveis.png")
    importance.to_csv(RES_DIR / "importancia_variaveis.csv", index=False)
    sizes, train_mean, test_mean = plot_learning_curve(final_model, X, y,
                                                       FIG_DIR / "13_curva_aprendizado.png")

    # Comparacao treino x teste do modelo final (diagnostico de sobreajuste)
    train_pred = final_model.predict(X_train)
    fit_gap = {
        "f1_macro_treino": f1_score(y_train, train_pred, average="macro"),
        "f1_macro_teste": f1_score(y_test, final_pred, average="macro"),
        "acuracia_treino": accuracy_score(y_train, train_pred),
        "acuracia_teste": accuracy_score(y_test, final_pred),
    }
    print(f"\nModelo final - treino x teste: {fit_gap}")

    # ------------------------------------------------------------------
    # 5) EXPERIMENTO AUXILIAR BINARIO (high risk vs. demais)
    # ------------------------------------------------------------------
    print("\n" + "=" * 74)
    print("5) EXPERIMENTO AUXILIAR - high risk vs. nao high risk")
    print("=" * 74)
    y_bin = (y == "high risk").astype(int)
    Xb_train, Xb_test, yb_train, yb_test = train_test_split(
        X, y_bin, test_size=0.30, stratify=y_bin, random_state=SEED)
    bin_models = {
        "Regressao Logistica": Pipeline([("scaler", StandardScaler()),
                                         ("clf", LogisticRegression(max_iter=5000,
                                                                    class_weight="balanced",
                                                                    random_state=SEED))]),
        "Random Forest": RandomForestClassifier(n_estimators=400, min_samples_leaf=2,
                                                class_weight="balanced_subsample",
                                                random_state=SEED, n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=200, learning_rate=0.05,
                                                        max_depth=3, random_state=SEED),
    }
    roc_data, bin_rows = {}, []
    for name, model in bin_models.items():
        model.fit(Xb_train, yb_train)
        prob = model.predict_proba(Xb_test)[:, 1]
        pred = (prob >= 0.5).astype(int)
        fpr, tpr, _ = roc_curve(yb_test, prob)
        auc_value = roc_auc_score(yb_test, prob)
        roc_data[name] = (fpr, tpr, auc_value)
        prec, rec, f1, _ = precision_recall_fscore_support(
            yb_test, pred, labels=[1], average=None, zero_division=0)
        bin_rows.append({"modelo": name, "auc": auc_value, "precisao_high": prec[0],
                         "revocacao_high": rec[0], "f1_high": f1[0],
                         "acuracia": accuracy_score(yb_test, pred)})
        print(f"  {name:<22} AUC={auc_value:.3f}  recall(high)={rec[0]:.3f}")
    bin_df = pd.DataFrame(bin_rows).sort_values("auc", ascending=False)
    bin_df.to_csv(RES_DIR / "binario_metricas.csv", index=False)
    plot_roc_binary(roc_data, FIG_DIR / "14_roc_binario.png")

    # ------------------------------------------------------------------
    # 6) RESUMO EM JSON
    # ------------------------------------------------------------------
    resumo = {
        "n_bruto": int(len(raw)),
        "n_tratado": int(len(clean)),
        "melhores_hiperparametros": search.best_params_,
        "cv_best_score": float(search.best_score_),
        "holdout": holdout.to_dict(orient="records"),
        "modelo_final": "Random Forest (ajustado)",
        "treino_teste_f1_macro": {k: float(v) for k, v in fit_gap.items()},
        "relatorio_final": reports["Random Forest (ajustado)"],
        "erros_ordinais": ordinal,
        "binario": bin_df.to_dict(orient="records"),
        "learning_curve": {"sizes": sizes.tolist(),
                           "treino": train_mean.round(4).tolist(),
                           "validacao": test_mean.round(4).tolist()},
        "importancia": importance.round(4).to_dict(orient="records"),
        "distribuicao_classes_tratada": clean[TARGET].value_counts().to_dict(),
    }
    with open(RES_DIR / "resumo.json", "w", encoding="utf-8") as fh:
        json.dump(resumo, fh, ensure_ascii=False, indent=2, default=str)

    print("\nArquivos gerados em:", FIG_DIR, "e", RES_DIR)
    print("\nResumo do holdout:\n", holdout.round(3).to_string(index=False))


if __name__ == "__main__":
    main()
