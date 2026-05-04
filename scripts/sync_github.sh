#!/usr/bin/env bash
# =============================================================================
# TOTEM — Sincronização automática com o GitHub
# Uso: bash scripts/sync_github.sh
#      npm run sync
#
# Fluxo: status → commit → pull --rebase → push
# O rebase evita "divergent branches" e commits de merge desnecessários.
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
info() { echo -e "${YELLOW}[INFO]${NC}  $*"; }
err()  { echo -e "${RED}[ERRO]${NC}  $*"; exit 1; }

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  TOTEM — Sincronização com GitHub${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""

# ── Verifica repositório Git ──────────────────────────────────────────────────
git rev-parse --git-dir > /dev/null 2>&1 || err "Este diretório não é um repositório Git."

# ── Verifica se há alterações locais ─────────────────────────────────────────
if git diff --quiet && git diff --staged --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  info "Nenhuma alteração local encontrada."
  info "Verificando se o remoto tem novidades..."
  git fetch origin main --quiet
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)
  if [ "$LOCAL" = "$REMOTE" ]; then
    ok "Repositório já está sincronizado. Nada a fazer."
    echo ""
    exit 0
  fi
  info "Remoto tem commits novos — puxando..."
  git pull origin main --rebase --quiet
  ok "Repositório atualizado com sucesso."
  echo ""
  exit 0
fi

# ── Mostra resumo das alterações ─────────────────────────────────────────────
echo -e "${BOLD}Arquivos modificados:${NC}"
git status --short
echo ""

# ── Mensagem do commit ────────────────────────────────────────────────────────
read -r -p "$(echo -e "${BOLD}Descreva o que você alterou${NC} (Enter = mensagem padrão): ")" MSG
if [ -z "$MSG" ]; then
  MSG="Update: Correções automáticas e melhorias"
  info "Usando mensagem padrão: \"$MSG\""
fi
echo ""

# ── git add ───────────────────────────────────────────────────────────────────
info "Adicionando arquivos..."
git add .
ok "git add . concluído"

# ── git commit ────────────────────────────────────────────────────────────────
info "Criando commit..."
git commit -m "$MSG" --quiet
ok "Commit criado: \"$MSG\""

# ── git pull --rebase ─────────────────────────────────────────────────────────
info "Sincronizando com o remoto (rebase)..."
if ! git pull origin main --rebase --quiet 2>/tmp/totem_pull_err; then
  if git status | grep -qE "rebase in progress|both modified|CONFLICT"; then
    echo ""
    echo -e "${RED}════════════════════════════════════════════════${NC}"
    echo -e "${RED}  CONFLITO DE MERGE DETECTADO${NC}"
    echo -e "${RED}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Arquivos em conflito:"
    git diff --name-only --diff-filter=U 2>/dev/null || git status --short
    echo ""
    echo -e "${YELLOW}Para resolver:${NC}"
    echo -e "  ${BOLD}1.${NC} Abra os arquivos em conflito e corrija manualmente"
    echo -e "  ${BOLD}2.${NC} git add ."
    echo -e "  ${BOLD}3.${NC} git rebase --continue"
    echo -e "  ${BOLD}4.${NC} npm run sync"
    echo ""
    echo -e "${YELLOW}Para cancelar e voltar ao estado anterior:${NC}"
    echo -e "       git rebase --abort"
    echo ""
    err "Resolva os conflitos acima antes de continuar."
  fi
  cat /tmp/totem_pull_err >&2
  err "Falha ao sincronizar com o remoto. Verifique sua conexão ou permissões."
fi
ok "Rebase concluído — histórico linear mantido"

# ── git push ──────────────────────────────────────────────────────────────────
info "Enviando para o GitHub..."
if ! git push origin main --quiet 2>/tmp/totem_push_err; then
  cat /tmp/totem_push_err >&2
  err "Falha no push. Verifique suas credenciais ou se a branch está protegida."
fi
ok "Push concluído com sucesso"

# ── Resumo final (sem expor credenciais da URL) ───────────────────────────────
REMOTE_URL=$(git remote get-url origin | sed 's|https://[^@]*@|https://|')
ACTIONS_URL=$(echo "$REMOTE_URL" | sed 's/\.git$//')/actions

echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}  Código enviado ao GitHub com sucesso!${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  Commit:      ${BOLD}$MSG${NC}"
echo -e "  Branch:      ${BOLD}main${NC}"
echo -e "  Repositório: $REMOTE_URL"
echo ""
echo -e "  GitHub Actions deve iniciar em instantes:"
echo -e "  $ACTIONS_URL"
echo ""
