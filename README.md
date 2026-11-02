# MyFinance — Sistema de Gestão Financeira Pessoal (Angola)

> *"Controla o teu dinheiro. Constrói o teu futuro."*

**MyFinance** é uma aplicação web completa, profissional, responsiva e offline-first desenhada especificamente para utilizadores em Angola. O sistema opera 100% no navegador (Client-Side) com persistência local em **IndexedDB**, garantindo total privacidade, zero custos de servidor e prontidão de implementação estática para **Vercel** e **GitHub Pages**.

---

## 🚀 Principais Funcionalidades

1. **Dashboard Financeiro Inteligente**:
   - Património total consolidado, saldo disponível para o dia-a-dia e saldo reservado em poupanças.
   - Receitas, despesas, balanço líquido e taxa de poupança percentual em tempo real.
   - Gráficos financeiros interativos via **Chart.js** (Receitas vs Despesas e Distribuição por Categoria).
   - Resumo das últimas transações e alertas de compromissos pendentes.

2. **Gestão de Contas Financeiras**:
   - 4 tipos fundamentais: Dinheiro Físico (Carteira), Conta Bancária (ex: BAI, BFA, BIC), Carteira Digital (Multicaixa Express, Unitel Money) e Conta Poupança.
   - Transferências atómicas entre contas com garantia matemática de invariância patrimonial (sem contagem espúria como despesa/receita).
   - Extratos detalhados por conta e opção de arquivamento.

3. **Transações & Comprovativos**:
   - Registo de receitas e despesas com suporte a categorias angolanas.
   - Anexo de recibos/comprovativos (armazenamento local base64 com pré-visualização e descarregamento).
   - Pesquisa em tempo real, filtros por tipo, conta, categoria e data.
   - Eliminação segura com reversão atómica e automática do saldo em conta.

4. **Orçamentos Mensais**:
   - Definição de limites de gastos por categoria no mês corrente.
   - Indicadores visuais dinâmicos de consumo com alertas a 75%, 90% e estado de ultrapassagem (100%+).

5. **Planeamento & Compromissos Futuros**:
   - Distinção estrita entre despesas planeadas e despesas liquidadas (compromissos não afetam o saldo real até à confirmação).
   - Ação de liquidação rápida ("Pagar Agora") que debita a conta associada no momento do pagamento.

6. **Objetivos de Poupança (Metas)**:
   - Metas com montante alvo, data limite e percentual de progresso.
   - Depósitos e resgates atómicos conectados com as tuas contas financeiras.

7. **Dívidas & Empréstimos**:
   - Registo de dívidas a terceiros (passivo) e montantes a receber (ativo).
   - Histórico de amortizações parciais com débito/crédito na conta bancária selecionada.

8. **Relatórios & Exportação**:
   - Evolução financeira anual e ranking de categorias.
   - Impressão formatada para PDF com cabeçalho limpo via `@media print`.
   - Exportação completa de transações em **CSV compatível com Excel** (separador `;` e codificação UTF-8 BOM para preservar acentuação).

9. **Privacidade & Segurança**:
   - **Modo Privacidade**: Ocultação instantânea de valores com um clique (ideal para utilização em locais públicos).
   - **Bloqueio por PIN local**: Código de 4 a 6 dígitos com hash salgado SHA-256 via Web Crypto API.
   - **Cópia de Segurança Completa (JSON)**: Exportação e restauração com validação de esquema, verificação de integridade e confirmação prévia.

10. **PWA & Offline Capability**:
    - Manifest web configurado e Service Worker para funcionamento ininterrupto sem ligação à Internet.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3** (com Tailwind CSS moderno)
- **Vanilla TypeScript / ES6+** modular
- **IndexedDB** como motor de base de dados primário e transacional
- **localStorage / sessionStorage** exclusivamente para preferências leves (tema, PIN, modo privacidade)
- **Chart.js** para gráficos financeiros de alta performance
- **Lucide Icons** para iconografia nítida e moderna
- **Vite** para empacotamento ultrarrápido

---

## 📦 Como Executar Localmente

### Pré-requisitos
- Node.js (v18+) e npm

### Instalação
```bash
# 1. Clonar o repositório
git clone https://github.com/seu-utilizador/myfinance.git
cd myfinance

# 2. Instalar dependências
npm install

# 3. Iniciar servidor de desenvolvimento local
npm run dev
```

Abre o teu navegador em `http://localhost:3000`.

### Executar Testes Unitários de Lógica Financeira
```bash
npx --yes tsx --test src/services/calculations.test.ts
```

---

## 🌐 Implementação em Produção (Vercel)

Esta aplicação é 100% estática e não necessita de nenhuma base de dados ou servidor backend externo.

1. Faz push do projeto para o GitHub.
2. Na [Vercel](https://vercel.com), clica em **Add New Project** e importa o repositório.
3. As configurações padrão são detetadas automaticamente:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Clica em **Deploy**. A tua aplicação MyFinance estará online em segundos!

---

## 🔒 Declaração de Privacidade
O MyFinance foi construído com a premissa de que os teus dados financeiros pertencem apenas a ti. Todos os registos são armazenados localmente na base de dados IndexedDB do teu navegador. Nenhum dado financeiro, saldo ou histórico é enviado para qualquer servidor na nuvem.
