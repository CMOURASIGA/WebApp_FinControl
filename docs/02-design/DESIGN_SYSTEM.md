# 7Finance - Design System e UX

## 1. Referência

O 7Finance deve pertencer visualmente à mesma família do 7Commander.

Isso significa consistência em:

- arquitetura de navegação;
- sidebar;
- cabeçalho;
- tipografia;
- espaçamento;
- cards;
- tabelas/listas;
- botões;
- estados;
- comportamento responsivo;
- white label;
- modais, drawers e páginas de cadastro.

Não significa copiar telas de gestão de projetos. O conteúdo deve continuar financeiro.

## 2. Diagnóstico do frontend atual

### Pontos já coerentes

- Sidebar fixa no desktop e recolhível no mobile.
- Navegação agrupada por domínio.
- Cabeçalho persistente.
- Componentes reutilizáveis de Button, Card, Input, Modal e StatCard.
- Uso de Tailwind, Lucide e tokens CSS de marca.
- White label com logo, cores e nome do produto.
- Estados responsivos em boa parte das grids.
- Modais para edição e ações críticas em despesas e investimentos.

### Pontos que precisam convergir

1. Cadastros curtos ainda aparecem como formulários abertos dentro da página.
2. Não existe componente Drawer padronizado.
3. Existem páginas muito densas com responsabilidades múltiplas.
4. Ações disponíveis não são filtradas consistentemente pelo perfil do usuário.
5. Estados de loading, empty, error e permission denied não seguem um componente comum.
6. Dashboard privilegia número, mas ainda tem pouco drill-down visual.
7. Algumas listas são divs responsivas sem padrão de tabela/lista operacional único.
8. Falta área persistente da Orion.
9. Falta padrão de confirmação central antes de ações irreversíveis.
10. Falta uma camada única de capabilities de UI.

## 3. Regra de containers de interação

### Modal central

Usar para:

- confirmação;
- alerta;
- aviso;
- erro de negócio;
- ação irreversível;
- pagamento;
- estorno;
- cancelamento;
- reativação;
- histórico rápido;
- visualização curta de detalhes.

Não usar modal como formulário grande de cadastro.

### Drawer lateral

Usar para cadastros e edições curtas, tipicamente até 8-10 campos e sem navegação interna complexa.

Exemplos no 7Finance:

- nova despesa;
- novo custo;
- nova receita simples;
- novo investimento;
- novo sócio;
- novo cliente;
- edição básica de registros.

### Página dedicada

Usar quando houver fluxo mais extenso, múltiplas seções ou contexto analítico.

Exemplos:

- projeto/contrato;
- fechamento mensal;
- parâmetros avançados;
- configuração de white label;
- configuração administrativa de acessos;
- análise detalhada de investimento;
- detalhe financeiro de projeto.

## 4. Navegação proposta

### Visão financeira

- Visão Geral
- Projetos e Receitas
- Custos e Despesas

### Sociedade

- Sócios
- Investimentos

### Gestão

- Simulador
- Fechamento e DRE
- Parâmetros

### Inteligência

Orion não precisa ser item de menu principal. Deve estar disponível globalmente no shell, com botão/launcher persistente e contexto da tela atual.

## 5. Dashboard

O dashboard deve possuir quatro níveis:

1. KPIs principais.
2. Previsto versus realizado.
3. Tendência temporal.
4. Explicação e ação.

Cada KPI importante deve permitir drill-down para os registros que o compõem.

Exemplo:

`Despesas corporativas R$ 12.400` -> abre lista filtrada da competência e categoria correspondente.

## 6. Componentes mínimos

Criar/padronizar:

- AppShell
- Sidebar
- PageHeader
- Button
- IconButton
- Card
- StatCard
- MetricComparisonCard
- DataTable
- ResponsiveList
- FilterBar
- EmptyState
- ErrorState
- LoadingState/Skeleton
- PermissionState
- Modal
- ConfirmModal
- Drawer
- FormSection
- Badge
- StatusBadge
- CurrencyInput
- PercentInput
- DateInput
- MonthPicker
- SearchInput
- Toast
- OrionLauncher
- OrionPanel

## 7. Responsividade

### Desktop

Sidebar persistente, conteúdo central limitado em largura e painéis analíticos lado a lado.

### Tablet

Sidebar recolhível e grids reduzidas.

### Mobile

- menu em overlay;
- cards em uma coluna;
- tabelas viram listas responsivas;
- ações principais permanecem acessíveis;
- drawers podem ocupar quase toda a largura;
- modais respeitam altura e scroll interno.

## 8. White label

O white label deve seguir a mesma regra da família Consult Services:

- logo do cliente;
- nome da empresa;
- nome/subtítulo do produto;
- cor principal;
- cor de destaque;
- preview antes de salvar;
- fallback seguro para identidade Consult Services;
- contraste mínimo legível;
- nunca permitir customização que torne textos ilegíveis.

A configuração deve ser por tenant no desenho SaaS final.

## 9. Acessibilidade e feedback

- foco visível;
- labels reais;
- aria-label em icon buttons;
- contraste adequado;
- mensagens de erro próximas do campo e resumo quando necessário;
- bloqueio de duplo submit;
- confirmação visual de sucesso;
- skeleton em carregamentos relevantes;
- empty state com ação sugerida.

## 10. Critério de aceite visual

Uma nova tela do 7Finance deve parecer parte da mesma suíte do 7Commander sem depender do logo para essa percepção.
