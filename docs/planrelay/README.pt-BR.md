# PlanRelay

Uma etapa de revisão humana para planos, alterações de código e feedback de agentes. Derivado independente do [Plannotator](https://github.com/backnotprop/plannotator), com código, histórico e licenças originais preservados.

## O que foi acrescentado

O módulo opcional `tools/planrelay` usa Node.js 22+, sem dependências externas:

- Planos, patches e código HTML com comentários por linha.
- Notas, sugestões e bloqueios com estado de resolução.
- Aprovação vinculada ao SHA-256 da versão importada.
- Alterar o conteúdo cria outra versão pendente; comentários anteriores continuam na versão original.
- Histórico, comparação do conteúdo anterior e exportação JSON/Markdown.
- Interface em português e inglês, temas claro e escuro.
- CLI para importar arquivos/stdin, capturar diffs do Git e consultar aprovação.

## Executar

```bash
git clone https://github.com/brunnojob/planrelay.git
cd planrelay
node tools/planrelay/cli.mjs import tools/planrelay/example-plan.md
node tools/planrelay/cli.mjs serve --port 4387
```

Abra http://127.0.0.1:4387. O espaço local fica em `.planrelay/state.json`; todos os comandos aceitam `--store CAMINHO` para usar outro arquivo.

Para atualizar o mesmo plano:

```bash
node tools/planrelay/cli.mjs import PLANO.md --id ID_DA_REVISAO
node tools/planrelay/cli.mjs check ID_DA_REVISAO
node tools/planrelay/cli.mjs export ID_DA_REVISAO --format markdown
```

`check` retorna 0 para a última versão **importada** e aprovada, 2 quando ainda falta revisão e 1 em caso de erro. Reimporte o arquivo após editá-lo: o comando não monitora arquivos nem valida automaticamente a árvore atual do Git.

## O que permanece da base

A suíte original conserva Inbox, plugins, hooks, MCP, anotações visuais de documentos/HTML e revisão rica de código em `apps/` e `packages/`. Ela usa Bun e configuração própria. O novo módulo tem armazenamento separado e não envia feedback automaticamente aos agentes nem sincroniza decisões com a suíte original.

A demonstração pública salva dados apenas no navegador; não acessa seu Git. O módulo local mostra Markdown e HTML como código-fonte, sem executar scripts. Comentários em diffs usam o número da linha no patch, não o número da linha do arquivo no GitHub.

Veja [README principal](../../README.md), [arquitetura e limites](ARCHITECTURE.md) e [documentação original](../../UPSTREAM-README.md).
