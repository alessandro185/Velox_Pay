const VeloxPaySimulator = (() => {
  const KEY_TX = "veloxpay_transactions_v2";
  const KEY_METHODS = "veloxpay_methods_v2";
  const KEY_SETTINGS = "veloxpay_settings_v2";
  const KEY_EXPORTS = "veloxpay_exports_v2";

  const DEFAULT_TRANSACTIONS = [
    { id: "001", method: "Pix", value: 44.91, status: "Aprovado", time: "hoje 21:38" },
    { id: "002", method: "Cartão", value: 89.9, status: "Aprovado", time: "hoje 21:15" },
    { id: "003", method: "Dinheiro", value: 32, status: "Aprovado", time: "hoje 20:52" },
    { id: "004", method: "Cartão", value: 57.5, status: "Recusado", time: "hoje 20:41" },
    { id: "005", method: "Pix", value: 22.41, status: "Pendente", time: "hoje 20:30" },
  ];

  const DEFAULT_METHODS = {
    Pix: true,
    "Cartão": true,
    Dinheiro: true,
    "Vale Refeição": false,
  };

  const DEFAULT_SETTINGS = {
    publicKey: "pk_test_veloxpay_7c92a1",
    secretKey: "sk_test_9f4c_veloxpay_secret",
    webhookSecret: "whsec_2a31e4a9b7",
    webhooks: {
      approved: true,
      refused: true,
      pending: false,
    },
  };

  // --- Helpers de Armazenamento ---
  function getTransactions() {
    try {
      const data = localStorage.getItem(KEY_TX);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Erro ao ler transações:", e);
    }
    saveTransactions(DEFAULT_TRANSACTIONS);
    return [...DEFAULT_TRANSACTIONS];
  }

  function saveTransactions(list) {
    try {
      localStorage.setItem(KEY_TX, JSON.stringify(list));
    } catch (e) {
      console.error("Erro ao salvar transações:", e);
    }
  }

  function getMethods() {
    try {
      const data = localStorage.getItem(KEY_METHODS);
      if (data) return JSON.parse(data);
    } catch (e) {}
    saveMethods(DEFAULT_METHODS);
    return { ...DEFAULT_METHODS };
  }

  function saveMethods(methods) {
    try {
      localStorage.setItem(KEY_METHODS, JSON.stringify(methods));
    } catch (e) {}
  }

  function getSettings() {
    try {
      const data = localStorage.getItem(KEY_SETTINGS);
      if (data) return JSON.parse(data);
    } catch (e) {}
    saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }

  function getExportCount() {
    return parseInt(localStorage.getItem(KEY_EXPORTS) || "7", 10);
  }

  function incrementExportCount() {
    const next = getExportCount() + 1;
    localStorage.setItem(KEY_EXPORTS, next.toString());
    return next;
  }

  // --- Formatação e Classes ---
  function brl(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function tagClass(method) {
    if (method === "Pix") return "tag tag-pix";
    if (method === "Dinheiro") return "tag tag-cash";
    return "tag tag-card";
  }

  function statusClass(status) {
    if (status === "Aprovado") return "pill pill-green";
    if (status === "Recusado") return "pill pill-red";
    return "pill pill-amber";
  }

  // --- Renderização de Transações ---
  function renderTransactions(container) {
    const table = container.querySelector("#transactionsTable");
    if (!table) return;

    const list = getTransactions();
    if (list.length === 0) {
      table.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--muted)">Nenhuma transação registrada.</td></tr>`;
      return;
    }

    table.innerHTML = list.map((item) => `
      <tr>
        <td><span class="mono muted">#${item.id}</span></td>
        <td><span class="${tagClass(item.method)}">${item.method}</span></td>
        <td>${brl(item.value)}${item.method === "Pix" ? '<span class="tag tag-pix" style="margin-left:6px">-10%</span>' : ""}</td>
        <td><span class="${statusClass(item.status)}">${item.status}</span></td>
        <td><span class="mono muted">${item.time}</span></td>
      </tr>
    `).join("");
  }

  // --- Atualização de Métricas do Dashboard ---
  function updateDashboardMetrics(container) {
    const txs = getTransactions();
    const approvedTxs = txs.filter((t) => t.status === "Aprovado");
    const refusedTxs = txs.filter((t) => t.status === "Recusado");
    const totalSum = approvedTxs.reduce((acc, t) => acc + Number(t.value), 0);
    const totalCount = txs.length;
    const approvedCount = approvedTxs.length;
    const refusedCount = refusedTxs.length;
    const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
    const refusalRate = totalCount > 0 ? Math.round((refusedCount / totalCount) * 100) : 0;

    // Economia Pix (10% sobre valor original)
    const pixApproved = approvedTxs.filter((t) => t.method === "Pix");
    const pixSavings = pixApproved.reduce((acc, t) => acc + (Number(t.value) / 0.9 * 0.1), 0);

    const mTotal = container.querySelector("#metricTotal");
    const mTotalSub = container.querySelector("#metricTotalSub");
    const mApproved = container.querySelector("#metricApproved");
    const mApprovedSub = container.querySelector("#metricApprovedSub");
    const mRefused = container.querySelector("#metricRefused");
    const mRefusedSub = container.querySelector("#metricRefusedSub");
    const mPixSavings = container.querySelector("#metricPixSavings");

    if (mTotal) mTotal.textContent = brl(totalSum);
    if (mTotalSub) mTotalSub.textContent = `${approvedCount} aprovados hoje`;
    if (mApproved) mApproved.textContent = approvedCount;
    if (mApprovedSub) mApprovedSub.textContent = `${approvalRate}% taxa de aprovação`;
    if (mRefused) mRefused.textContent = refusedCount;
    if (mRefusedSub) mRefusedSub.textContent = `${refusalRate}% de recusa simulada`;
    if (mPixSavings) mPixSavings.textContent = brl(pixSavings);

    // Barras de distribuição
    const pixCount = txs.filter((t) => t.method === "Pix").length;
    const cardCount = txs.filter((t) => t.method === "Cartão").length;
    const cashCount = txs.filter((t) => t.method === "Dinheiro").length;
    const pPix = totalCount > 0 ? Math.round((pixCount / totalCount) * 100) : 0;
    const pCard = totalCount > 0 ? Math.round((cardCount / totalCount) * 100) : 0;
    const pCash = totalCount > 0 ? Math.max(0, 100 - pPix - pCard) : 0;

    const bPix = container.querySelector("#barPix");
    const vPix = container.querySelector("#valPix");
    const bCard = container.querySelector("#barCard");
    const vCard = container.querySelector("#valCard");
    const bCash = container.querySelector("#barCash");
    const vCash = container.querySelector("#valCash");

    if (bPix) bPix.style.width = `${pPix}%`;
    if (vPix) vPix.textContent = `${pPix}%`;
    if (bCard) bCard.style.width = `${pCard}%`;
    if (vCard) vCard.textContent = `${pCard}%`;
    if (bCash) bCash.style.width = `${pCash}%`;
    if (vCash) vCash.textContent = `${pCash}%`;
  }

  // --- Sincronizar Dropdown de Métodos no Dashboard ---
  function syncPaymentMethodsDropdown(container) {
    const select = container.querySelector("#inp-metodo");
    if (!select) return;
    const methods = getMethods();

    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      const isEnabled = methods[opt.value] !== false;
      opt.disabled = !isEnabled;
      if (!isEnabled) {
        if (!opt.text.includes("(Desativado)")) {
          opt.text = `${opt.value} (Desativado nas configurações)`;
        }
      } else {
        if (opt.value === "Pix") opt.text = "Pix - desconto 10%";
        else if (opt.value === "Cartão") opt.text = "Cartão";
        else if (opt.value === "Dinheiro") opt.text = "Dinheiro - sempre aprovado";
      }
    });
  }

  // --- Processar Novo Pagamento ---
  function simulatePayment(container) {
    const order = container.querySelector("#inp-pedido")?.value?.trim();
    const value = parseFloat(container.querySelector("#inp-valor")?.value);
    const method = container.querySelector("#inp-metodo")?.value;
    const result = container.querySelector("#resultado");

    if (!result) return;

    if (!order || isNaN(value) || value <= 0 || !method) {
      result.style.color = "var(--red)";
      result.textContent = "Preencha o ID do pedido, um valor válido e selecione o método.";
      return;
    }

    const methods = getMethods();
    if (methods[method] === false) {
      result.style.color = "var(--red)";
      result.textContent = `O método ${method} está desativado no momento.`;
      return;
    }

    const finalValue = method === "Pix" ? Number((value * 0.9).toFixed(2)) : Number(value.toFixed(2));
    const status = method === "Dinheiro" ? "Aprovado" : (Math.random() < 0.85 ? "Aprovado" : "Recusado");

    const now = new Date();
    const timeStr = `hoje ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newTx = {
      id: order.padStart(3, "0"),
      method,
      value: finalValue,
      status,
      time: timeStr,
    };

    const currentList = getTransactions();
    currentList.unshift(newTx);
    saveTransactions(currentList);

    result.style.color = status === "Aprovado" ? "var(--green)" : "var(--red)";
    result.textContent = `✓ Pedido #${order} -> ${status} (${brl(finalValue)}) - Salvo com sucesso!`;

    // Limpar campos
    const inpOrder = container.querySelector("#inp-pedido");
    const inpVal = container.querySelector("#inp-valor");
    if (inpOrder) inpOrder.value = "";
    if (inpVal) inpVal.value = "";

    renderTransactions(container);
    updateDashboardMetrics(container);
  }

  // --- Resetar / Limpar Dados ---
  function resetData(container) {
    if (confirm("Deseja restaurar as transações padrão de exemplo?")) {
      saveTransactions(DEFAULT_TRANSACTIONS);
      renderTransactions(container);
      updateDashboardMetrics(container);
      const res = container.querySelector("#resultado");
      if (res) {
        res.style.color = "var(--blue)";
        res.textContent = "Dados restaurados para o padrão!";
      }
    }
  }

  // --- Gerenciamento da Tela de Métodos ---
  function bindMethodsView(container) {
    const methods = getMethods();

    container.querySelectorAll("input[data-method]").forEach((input) => {
      const methodName = input.dataset.method;
      input.checked = methods[methodName] !== false;

      input.addEventListener("change", () => {
        methods[methodName] = input.checked;
        saveMethods(methods);
        updateMethodsBars(container);
      });
    });

    updateMethodsBars(container);
  }

  function updateMethodsBars(container) {
    const txs = getTransactions();
    const totalCount = txs.length;
    const pixCount = txs.filter((t) => t.method === "Pix").length;
    const cardCount = txs.filter((t) => t.method === "Cartão").length;
    const cashCount = txs.filter((t) => t.method === "Dinheiro").length;

    const pPix = totalCount > 0 ? Math.round((pixCount / totalCount) * 100) : 0;
    const pCard = totalCount > 0 ? Math.round((cardCount / totalCount) * 100) : 0;
    const pCash = totalCount > 0 ? Math.max(0, 100 - pPix - pCard) : 0;

    const bPix = container.querySelector("#barPixMethod");
    const vPix = container.querySelector("#valPixMethod");
    const bCard = container.querySelector("#barCardMethod");
    const vCard = container.querySelector("#valCardMethod");
    const bCash = container.querySelector("#barCashMethod");
    const vCash = container.querySelector("#valCashMethod");

    if (bPix) bPix.style.width = `${pPix}%`;
    if (vPix) vPix.textContent = `${pPix}%`;
    if (bCard) bCard.style.width = `${pCard}%`;
    if (vCard) vCard.textContent = `${pCard}%`;
    if (bCash) bCash.style.width = `${pCash}%`;
    if (vCash) vCash.textContent = `${pCash}%`;
  }

  // --- Gerenciamento da Tela de Configurações ---
  function bindSettingsView(container) {
    const settings = getSettings();

    const inpPub = container.querySelector("#cfgPublicKey");
    const inpSec = container.querySelector("#cfgSecretKey");
    const inpWh = container.querySelector("#cfgWebhookSecret");

    if (inpPub) inpPub.value = settings.publicKey || "";
    if (inpSec) inpSec.value = settings.secretKey || "";
    if (inpWh) inpWh.value = settings.webhookSecret || "";

    container.querySelectorAll("input[data-webhook]").forEach((input) => {
      const hookName = input.dataset.webhook;
      input.checked = settings.webhooks && settings.webhooks[hookName] !== false;
    });

    container.querySelector("[data-action='save-settings']")?.addEventListener("click", () => {
      const updated = {
        publicKey: container.querySelector("#cfgPublicKey")?.value || "",
        secretKey: container.querySelector("#cfgSecretKey")?.value || "",
        webhookSecret: container.querySelector("#cfgWebhookSecret")?.value || "",
        webhooks: {},
      };

      container.querySelectorAll("input[data-webhook]").forEach((input) => {
        updated.webhooks[input.dataset.webhook] = input.checked;
      });

      saveSettings(updated);

      const res = container.querySelector("#settingsResult");
      if (res) {
        res.style.color = "var(--green)";
        res.textContent = "✓ Configurações e Webhooks salvos com sucesso!";
        setTimeout(() => {
          if (res) res.textContent = "";
        }, 3000);
      }
    });
  }

  // --- Gerenciamento da Tela de Relatórios ---
  function bindReportsView(container) {
    const txs = getTransactions();
    const approvedTxs = txs.filter((t) => t.status === "Aprovado");
    const totalSum = approvedTxs.reduce((acc, t) => acc + Number(t.value), 0);
    const avgTicket = approvedTxs.length > 0 ? totalSum / approvedTxs.length : 0;

    const rFat = container.querySelector("#repFaturamento");
    const rTx = container.querySelector("#repTransacoes");
    const rTicket = container.querySelector("#repTicket");
    const rExp = container.querySelector("#repExportacoes");

    if (rFat) rFat.textContent = brl(totalSum);
    if (rTx) rTx.textContent = txs.length;
    if (rTicket) rTicket.textContent = brl(avgTicket);
    if (rExp) rExp.textContent = getExportCount();
  }

  // --- Ações de Utilidade (Tokens, Copiar, Exportar) ---
  function toggleToken(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Ver" : "Ocultar";
  }

  async function copyCode(button) {
    const code = button.parentElement.querySelector("code")?.innerText || "";
    try {
      await navigator.clipboard.writeText(code);
      const original = button.textContent;
      button.textContent = "Copiado!";
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    } catch (e) {
      button.textContent = "Copiado!";
    }
  }

  function exportCSV(button) {
    const txs = getTransactions();
    const headers = ["Pedido", "Metodo", "Valor", "Status", "Data"];
    const rows = txs.map((t) => [t.id, t.method, t.value.toFixed(2), t.status, t.time]);
    const csvContent = [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `veloxpay_relatorio_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const nextCount = incrementExportCount();
    const original = button.textContent;
    button.textContent = "Baixado!";
    setTimeout(() => {
      button.textContent = original;
    }, 1400);

    const rExp = document.getElementById("repExportacoes");
    if (rExp) rExp.textContent = nextCount;
  }

  function exportPDF(button) {
    window.print();
    const nextCount = incrementExportCount();
    const rExp = document.getElementById("repExportacoes");
    if (rExp) rExp.textContent = nextCount;
  }

  // --- Vinculação de Visualização Global ---
  function bindView(container) {
    // 1. Dashboard
    renderTransactions(container);
    updateDashboardMetrics(container);
    syncPaymentMethodsDropdown(container);

    container.querySelector("[data-action='simulate-payment']")
      ?.addEventListener("click", () => simulatePayment(container));

    container.querySelector("[data-action='reset-data']")
      ?.addEventListener("click", () => resetData(container));

    // 2. Métodos
    bindMethodsView(container);

    // 3. Configurações
    bindSettingsView(container);

    // 4. Relatórios
    bindReportsView(container);

    // 5. Botões Globais
    container.querySelectorAll("[data-action='toggle-token']").forEach((button) => {
      button.addEventListener("click", () => toggleToken(button.dataset.target, button));
    });

    container.querySelectorAll("[data-action='copy-code']").forEach((button) => {
      button.addEventListener("click", () => copyCode(button));
    });

    container.querySelectorAll("[data-action='export-report']").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.textContent.includes("CSV")) {
          exportCSV(button);
        } else {
          exportPDF(button);
        }
      });
    });
  }

  return {
    bindView,
    getTransactions,
    getMethods,
    getSettings,
  };
})();
