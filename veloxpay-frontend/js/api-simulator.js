const VeloxPaySimulator = (() => {
  const KEY_TX = "veloxpay_transactions_v2";
  const KEY_METHODS = "veloxpay_methods_v2";
  const KEY_SETTINGS = "veloxpay_settings_v2";
  const KEY_EXPORTS = "veloxpay_exports_v2";

  const DEFAULT_TRANSACTIONS = [
    { id: "001", method: "Pix", value: 44.91, status: "Aprovado", time: "hoje 21:38", client: "Maria Oliveira" },
    { id: "002", method: "Cartão", value: 89.9, status: "Aprovado", time: "hoje 21:15", client: "Carlos Mendes" },
    { id: "003", method: "Dinheiro", value: 32, status: "Aprovado", time: "hoje 20:52", client: "Balcão Presencial" },
    { id: "004", method: "Cartão", value: 57.5, status: "Recusado", time: "hoje 20:41", client: "Ana Paula" },
    { id: "005", method: "Pix", value: 22.41, status: "Pendente", time: "hoje 20:30", client: "Felipe Santos" },
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

  // --- Armazenamento Local ---
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

  // --- Helpers de Formatação ---
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

  // --- 1. DASHBOARD ---
  function renderDashboardTransactions(container) {
    const table = container.querySelector("#transactionsTable");
    if (!table) return;

    const list = getTransactions().slice(0, 6);
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
    if (mRefusedSub) mRefusedSub.textContent = `${refusalRate}% taxa de recusa`;
    if (mPixSavings) mPixSavings.textContent = brl(pixSavings);

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

  function syncPaymentMethodsDropdown(container, selectSelector = "#inp-metodo") {
    const select = container.querySelector(selectSelector);
    if (!select) return;
    const methods = getMethods();

    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      const isEnabled = methods[opt.value] !== false;
      opt.disabled = !isEnabled;
      if (!isEnabled) {
        if (!opt.text.includes("(Desativado)")) {
          opt.text = `${opt.value} (Desativado)`;
        }
      } else {
        if (opt.value === "Pix") opt.text = "Pix (10% de desconto automático)";
        else if (opt.value === "Cartão") opt.text = "Cartão de Crédito";
        else if (opt.value === "Dinheiro") opt.text = "Dinheiro (Aprovação imediata)";
      }
    });
  }

  // Quick payment form in Dashboard
  function simulateQuickPayment(container) {
    const order = container.querySelector("#inp-pedido")?.value?.trim();
    const value = parseFloat(container.querySelector("#inp-valor")?.value);
    const method = container.querySelector("#inp-metodo")?.value;
    const result = container.querySelector("#resultado");

    if (!result) return;

    if (!order || isNaN(value) || value <= 0 || !method) {
      result.style.color = "var(--red)";
      result.textContent = "Preencha o ID do pedido, valor válido e selecione o método.";
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
      client: "Venda Rápida",
    };

    const currentList = getTransactions();
    currentList.unshift(newTx);
    saveTransactions(currentList);

    result.style.color = status === "Aprovado" ? "var(--green)" : "var(--red)";
    result.textContent = `✓ Pedido #${order} -> ${status} (${brl(finalValue)}) - Salvo no histórico!`;

    const inpOrder = container.querySelector("#inp-pedido");
    const inpVal = container.querySelector("#inp-valor");
    if (inpOrder) inpOrder.value = "";
    if (inpVal) inpVal.value = "";

    renderDashboardTransactions(container);
    updateDashboardMetrics(container);
  }

  // --- 2. TELA DEDICADA: TRANSAÇÕES (views/transacoes.html) ---
  function bindTransactionsView(container) {
    const table = container.querySelector("#fullTransactionsTable");
    if (!table) return;

    function renderFiltered() {
      const search = (container.querySelector("#txFilterSearch")?.value || "").toLowerCase().trim();
      const selMethod = container.querySelector("#txFilterMethod")?.value || "";
      const selStatus = container.querySelector("#txFilterStatus")?.value || "";

      let list = getTransactions();

      if (search) {
        list = list.filter((t) =>
          t.id.toLowerCase().includes(search) ||
          (t.client && t.client.toLowerCase().includes(search)) ||
          t.value.toString().includes(search)
        );
      }

      if (selMethod) {
        list = list.filter((t) => t.method === selMethod);
      }

      if (selStatus) {
        list = list.filter((t) => t.status === selStatus);
      }

      // Update metrics
      const allTxs = getTransactions();
      const approvedTxs = allTxs.filter((t) => t.status === "Aprovado");
      const volumeSum = approvedTxs.reduce((acc, t) => acc + Number(t.value), 0);
      const totalCount = allTxs.length;
      const successRate = totalCount > 0 ? Math.round((approvedTxs.length / totalCount) * 100) : 0;
      const refusedCount = allTxs.filter((t) => t.status === "Recusado").length;

      const mVol = container.querySelector("#txMetricVolume");
      const mVolSub = container.querySelector("#txMetricVolumeSub");
      const mTot = container.querySelector("#txMetricTotal");
      const mSuc = container.querySelector("#txMetricSuccess");
      const mRef = container.querySelector("#txMetricRefused");

      if (mVol) mVol.textContent = brl(volumeSum);
      if (mVolSub) mVolSub.textContent = `${approvedTxs.length} pedidos liquidados`;
      if (mTot) mTot.textContent = totalCount;
      if (mSuc) mSuc.textContent = `${successRate}%`;
      if (mRef) mRef.textContent = refusedCount;

      if (list.length === 0) {
        table.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted)">Nenhuma transação encontrada com os filtros aplicados.</td></tr>`;
        return;
      }

      table.innerHTML = list.map((item) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="mono" style="font-weight:700">#${item.id}</span>
              ${item.client ? `<small class="muted" style="font-size:11px">(${item.client})</small>` : ""}
            </div>
          </td>
          <td><span class="${tagClass(item.method)}">${item.method}</span></td>
          <td>
            <strong>${brl(item.value)}</strong>
            ${item.method === "Pix" ? '<span class="tag tag-pix" style="margin-left:6px;font-size:9px">-10% Pix</span>' : ""}
          </td>
          <td><span class="${statusClass(item.status)}">${item.status}</span></td>
          <td><span class="mono muted">${item.time}</span></td>
        </tr>
      `).join("");
    }

    container.querySelector("#txFilterSearch")?.addEventListener("input", renderFiltered);
    container.querySelector("#txFilterMethod")?.addEventListener("change", renderFiltered);
    container.querySelector("#txFilterStatus")?.addEventListener("change", renderFiltered);

    renderFiltered();
  }

  // --- 3. TELA DEDICADA: NOVO PAGAMENTO (views/novo-pagamento.html) ---
  function bindNovoPagamentoView(container) {
    syncPaymentMethodsDropdown(container, "#inp-np-metodo");

    const inpValor = container.querySelector("#inp-np-valor");
    const inpMetodo = container.querySelector("#inp-np-metodo");
    const previewSub = container.querySelector("#previewSubtotal");
    const previewDesc = container.querySelector("#previewDesconto");
    const previewTot = container.querySelector("#previewTotal");
    const methodBox = container.querySelector("#previewMethodBox");
    const extraBox = container.querySelector("#paymentDynamicExtra");

    function updateLivePreview() {
      const rawVal = parseFloat(inpValor?.value) || 0;
      const method = inpMetodo?.value || "";

      let discount = 0;
      let finalVal = rawVal;

      if (method === "Pix" && rawVal > 0) {
        discount = rawVal * 0.1;
        finalVal = rawVal * 0.9;
      }

      if (previewSub) previewSub.textContent = brl(rawVal);
      if (previewDesc) previewDesc.textContent = `- ${brl(discount)}`;
      if (previewTot) previewTot.textContent = brl(finalVal);

      if (!method) {
        if (methodBox) {
          methodBox.innerHTML = `<div style="font-size:12px;color:var(--muted)">Selecione um método de pagamento para pré-visualizar.</div>`;
        }
        if (extraBox) extraBox.innerHTML = "";
        return;
      }

      if (method === "Pix") {
        if (methodBox) {
          methodBox.innerHTML = `
            <div style="display:grid;gap:6px;text-align:center;">
              <span class="pill pill-green" style="margin:0 auto;">Chave Pix Dinâmica</span>
              <div style="font-family:var(--font-mono);font-size:11px;background:var(--surface);padding:8px;border-radius:4px;word-break:break-all;color:var(--green)">
                00020126580014br.gov.bcb.pix0136veloxpay-checkout-${Date.now()}
              </div>
              <small class="muted" style="font-size:11px">Aprovação instantânea via Webhook</small>
            </div>
          `;
        }
        if (extraBox) {
          extraBox.innerHTML = `
            <div class="pill pill-green" style="width:100%;justify-content:center;padding:6px;border-radius:var(--radius)">
              ⚡ 10% de desconto aplicado automaticamente no Pix!
            </div>
          `;
        }
      } else if (method === "Cartão") {
        if (methodBox) {
          methodBox.innerHTML = `
            <div style="display:grid;gap:6px;text-align:left;font-size:12px;">
              <span class="pill pill-blue">Gateway de Cartão</span>
              <div style="color:var(--muted);">Simulação com processamento de bandeira Visa/Mastercard. Taxa de autorização média: 85%.</div>
            </div>
          `;
        }
        if (extraBox) {
          extraBox.innerHTML = `
            <label class="form-row">
              <span class="form-label">Parcelamento</span>
              <select class="select">
                <option>1x de ${brl(finalVal)} sem juros</option>
                <option>2x de ${brl(finalVal / 2)} sem juros</option>
                <option>3x de ${brl(finalVal / 3)} sem juros</option>
              </select>
            </label>
          `;
        }
      } else if (method === "Dinheiro") {
        if (methodBox) {
          methodBox.innerHTML = `
            <div style="display:grid;gap:6px;text-align:center;">
              <span class="pill pill-amber" style="margin:0 auto;">Recebimento em Balcão</span>
              <div style="font-size:12px;color:var(--muted)">Pagamento registrado e aprovado no caixa sem taxas adicionais.</div>
            </div>
          `;
        }
        if (extraBox) extraBox.innerHTML = "";
      }
    }

    inpValor?.addEventListener("input", updateLivePreview);
    inpMetodo?.addEventListener("change", updateLivePreview);

    container.querySelector("[data-action='submit-novo-pagamento']")?.addEventListener("click", () => {
      const order = container.querySelector("#inp-np-pedido")?.value?.trim();
      const client = container.querySelector("#inp-np-cliente")?.value?.trim() || "Cliente Balcão";
      const value = parseFloat(container.querySelector("#inp-np-valor")?.value);
      const method = container.querySelector("#inp-np-metodo")?.value;
      const result = container.querySelector("#np-resultado");
      const receipt = container.querySelector("#receiptContainer");

      if (!order || isNaN(value) || value <= 0 || !method) {
        if (result) {
          result.style.color = "var(--red)";
          result.textContent = "Preencha o ID do pedido, um valor válido e selecione o método.";
        }
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
        client,
      };

      const currentList = getTransactions();
      currentList.unshift(newTx);
      saveTransactions(currentList);

      if (result) {
        result.style.color = status === "Aprovado" ? "var(--green)" : "var(--red)";
        result.textContent = `✓ Pedido #${order} processado com status: ${status} (${brl(finalValue)})! Gravado com sucesso no banco local.`;
      }

      // Generate digital receipt
      if (receipt) {
        receipt.innerHTML = `
          <div style="border-bottom:1px dashed var(--border);padding-bottom:6px;margin-bottom:6px">
            <strong style="color:var(--text)">COMPROVANTE DE TRANSAÇÃO - VELOXPAY</strong><br>
            <span class="muted">Autenticação: ${Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
          </div>
          <div><strong>Pedido:</strong> #${order.padStart(3, "0")}</div>
          <div><strong>Cliente:</strong> ${client}</div>
          <div><strong>Método:</strong> ${method}</div>
          <div><strong>Valor Liquidado:</strong> ${brl(finalValue)}</div>
          <div><strong>Status:</strong> <span class="${statusClass(status)}">${status}</span></div>
          <div><strong>Data/Hora:</strong> ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}</div>
        `;
      }

      // Clear input order & value
      const inpO = container.querySelector("#inp-np-pedido");
      const inpV = container.querySelector("#inp-np-valor");
      const inpC = container.querySelector("#inp-np-cliente");
      if (inpO) inpO.value = "";
      if (inpV) inpV.value = "";
      if (inpC) inpC.value = "";
      updateLivePreview();
    });
  }

  // --- 4. RESETAR DADOS ---
  function resetData(container) {
    if (confirm("Deseja restaurar as transações padrão de exemplo?")) {
      saveTransactions(DEFAULT_TRANSACTIONS);
      renderDashboardTransactions(container);
      updateDashboardMetrics(container);
      bindTransactionsView(container);
      alert("Dados restaurados com sucesso!");
    }
  }

  // --- 5. TELA DE MÉTODOS ---
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

  // --- 6. TELA DE CONFIGURAÇÕES ---
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

  // --- 7. TELA DE RELATÓRIOS ---
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

  // --- Utilidades ---
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
    const headers = ["Pedido", "Cliente", "Metodo", "Valor", "Status", "Data"];
    const rows = txs.map((t) => [t.id, t.client || "-", t.method, t.value.toFixed(2), t.status, t.time]);
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
    if (button) {
      const original = button.textContent;
      button.textContent = "Baixado!";
      setTimeout(() => {
        button.textContent = original;
      }, 1400);
    }

    const rExp = document.getElementById("repExportacoes");
    if (rExp) rExp.textContent = nextCount;
  }

  function exportPDF(button) {
    window.print();
    const nextCount = incrementExportCount();
    const rExp = document.getElementById("repExportacoes");
    if (rExp) rExp.textContent = nextCount;
  }

  // --- BIND GLOBAL DE VISUALIZAÇÃO ---
  function bindView(container) {
    // 1. Dashboard
    renderDashboardTransactions(container);
    updateDashboardMetrics(container);
    syncPaymentMethodsDropdown(container, "#inp-metodo");

    container.querySelector("[data-action='simulate-payment']")
      ?.addEventListener("click", () => simulateQuickPayment(container));

    container.querySelector("[data-action='reset-data']")
      ?.addEventListener("click", () => resetData(container));

    // 2. Dedicada: Transações
    bindTransactionsView(container);

    // 3. Dedicada: Novo Pagamento
    bindNovoPagamentoView(container);

    // 4. Métodos
    bindMethodsView(container);

    // 5. Configurações
    bindSettingsView(container);

    // 6. Relatórios
    bindReportsView(container);

    // 7. Botões Globais
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
