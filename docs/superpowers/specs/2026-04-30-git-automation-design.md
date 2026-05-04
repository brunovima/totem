# Design: Git + Automação de Documentação — TOTEM

**Data:** 2026-04-30  
**Status:** Aprovado

---

## Objetivo

Inicializar o repositório git do projeto TOTEM e automatizar o registro de desenvolvimento: a cada tarefa concluída pelo Claude, um commit é criado com mensagem descritiva, o `CHANGELOG.md` é atualizado com data e resumo, e o `CLAUDE.md` recebe uma nova linha na tabela de histórico.

---

## Componentes

### 1. Repositório Git

- `git init` na raiz do projeto (`totem-main/`)
- Commit inicial com todos os arquivos atuais (respeitando `.gitignore` existente)
- `.gitignore` já cobre: `node_modules`, `dist`, `out`, `release`, `.env`, `*.log*`

### 2. Script `scripts/dev-commit.ps1`

Script PowerShell chamado pelo Claude ao final de cada tarefa.

**Entrada:** mensagem de commit (string)  
**Ações:**
1. `git add -A`
2. `git commit -m "<mensagem>"`
3. Captura o hash curto do commit
4. Prepend de nova entrada no `CHANGELOG.md` (data + resumo + arquivos afetados)
5. Adiciona linha na tabela "Histórico de Desenvolvimento" do `CLAUDE.md`
6. Commit final dos arquivos de documentação (`CHANGELOG.md` + `CLAUDE.md`)

**Assinatura:**
```powershell
.\scripts\dev-commit.ps1 -Message "feat: descrição da tarefa" -Details "- item 1`n- item 2"
```

### 3. Hook `Stop` em `.claude/settings.json`

Roda após cada resposta do Claude. Verifica se há arquivos modificados sem commit via `git status --porcelain`. Se houver, exibe aviso no terminal para lembrar o Claude de commitar antes de encerrar.

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cd c:/Users/97715220191/Downloads/totem-main/totem-main && git status --porcelain | head -5"
          }
        ]
      }
    ]
  }
}
```

### 4. Atualizações no `CLAUDE.md`

**Seção nova: "Histórico de Desenvolvimento"**
```markdown
## Histórico de Desenvolvimento
| Data | Resumo | Commit |
|------|--------|--------|
| 2026-04-30 | Inicialização do git e automação de commits | abc1234 |
```

**Regra nova nas "Regras inegociáveis de código":**
> Após cada tarefa concluída, executar `scripts/dev-commit.ps1` com mensagem descritiva. Nunca encerrar sem commitar e documentar.

### 5. `CHANGELOG.md` (novo arquivo)

```markdown
# Changelog — TOTEM

## [2026-04-30]
### Infraestrutura
- Inicialização do repositório git
- Criação do script dev-commit.ps1
- Hook Stop configurado no Claude Code
- Seção Histórico adicionada ao CLAUDE.md
```

---

## Fluxo de Trabalho Após Implementação

```
Claude conclui tarefa
  → chama scripts/dev-commit.ps1 -Message "..." -Details "..."
    → git add -A + git commit
    → atualiza CHANGELOG.md
    → atualiza tabela no CLAUDE.md
    → commit dos docs
  → Hook Stop mostra git status (segurança)
```

---

## Fora do Escopo

- Push automático para remote (GitHub/GitLab) — não configurado
- Geração automática de mensagens de commit por IA — Claude escreve a mensagem
- Versionamento semântico automático (semver) — manual quando necessário
