# Design: Ativação Facultativa de Jogo e Quiz

**Data:** 2026-05-04  
**Status:** Aprovado

## Problema

A regra anterior impedia que jogo da memória e quiz estivessem ativos simultaneamente. O objetivo é tornar essa restrição opcional: o admin pode ativar um, o outro, ambos ou nenhum.

## Contexto do código atual

- `App.jsx` já trata corretamente os casos "ambos ativos" (→ `selecionar-jogo`) e "só jogo ativo" (→ `jogo-memoria`). O `SelecionarJogo` component já existe e está integrado.
- `database.js` **nunca teve** cross-deactivation nos handlers `toggle-quiz` e `toggle-jogo` — cada um desativa apenas dentro do seu próprio tipo.
- `GerenciarJogos.jsx` exibia mensagem enganosa `"quizzes foram desativados"` sem que isso ocorresse de fato.
- O `else` final do bloco de roteamento em `App.jsx` capturava tanto "só quiz ativo" quanto "nenhum ativo" indistintamente.

## Mudanças

### 1. `App.jsx` — roteamento pós-LeadForm

Separar o `else` atual em dois casos:

| Condição | Antes | Depois |
|---|---|---|
| quiz ativo + jogo ativo | `selecionar-jogo` | `selecionar-jogo` (sem mudança) |
| só jogo ativo | `jogo-memoria` | `jogo-memoria` (sem mudança) |
| só quiz ativo | `quiz` (via else) | `quiz` (explícito) |
| nenhum ativo | `quiz` (incorreto) | salva lead (score=0), `thankyou` genérico |

Para o caso "nenhum ativo": `await window.api.saveLead({ ...currentLead, score: 0 })`, depois `setThankYouData({ nome, quizTitle: null, score: 0, total: 0 })` e `setCurrentScreen('thankyou')`.

### 2. `ThankYou.jsx` — modo genérico

Quando `total === 0`, ocultar os blocos específicos de quiz:
- Ocultar: linha "Você completou o quiz {quizTitle}"
- Ocultar: componente `Stars`
- Ocultar: bloco de placar (score/total/%)

Manter: emoji 🎉, "Parabéns, {nome}!", mensagem motivacional ("Obrigado pela participação!"), countdown 10s.

Nenhuma prop nova — usa `total > 0` como condição.

### 3. `GerenciarJogos.jsx` — mensagem correta

Linha 54: remover `"(quizzes foram desativados)"` do feedback de ativação. Novo texto: `"Jogo "${jogo.nome}" ativado."`.

## Arquivos alterados

- `src/renderer/src/App.jsx`
- `src/renderer/src/components/ThankYou.jsx`
- `src/renderer/src/components/GerenciarJogos.jsx`

## Arquivos não alterados

- `src/main/database.js` — já estava correto
- `src/renderer/src/components/SelecionarJogo.jsx` — já estava correto
- `src/preload/index.js` — nenhuma nova API necessária
