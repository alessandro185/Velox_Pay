const VeloxPaySimulator = (() => {
  const transactions = [
    { id: "001", method: "Pix", value: 44.91, status: "Aprovado", time: "hoje 21:38" },
    { id: "002", method: "Cartão", value: 89.9, status: "Aprovado", time: "hoje 21:15" },
    { id: "003", method: "Dinheiro", value: 32, status: "Aprovado", time: "hoje 20:52" },
    { id: "004", method: "Cartão", value: 57.5, status: "Recusado", time: "hoje 20:41" },
    { id: "005", method: "Pix", value: 22.41, status: "Pendente", time: "hoje 20:30" },
  ];

  function brl(value) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  function renderTransactions(container) {
    const table = container.querySelector("#transactionsTable");
    if (!table) return;

    table.innerHTML = transactions.map((item) => `
      <tr>
        <td><span class="mono muted">#${item.id}</span></td>
        <td><span class="${tagClass(item.method)}">${item.method}</span></td>
        <td>${brl(item.value)}${item.method === "Pix" ? '<span class="tag tag-pix" style="margin-left:6px">-10%</span>' : ""}</td>
        <td><span class="${statusClass(item.status)}">${item.status}</span></td>
        <td><span class="mono muted">${item.time}</span></td>
      </tr>
    `).join("");
  }

  function simulatePayment(container) {
    const order = container.querySelector("#inp-pedido")?.value;
    const value = parseFloat(container.querySelector("#inp-valor")?.value);
    const method = container.querySelector("#inp-metodo")?.value;
    const result = container.querySelector("#resultado");

    if (!result) return;

    if (!order || !value || !method) {
      result.style.color = "var(--red)";
      result.textContent = "Preencha todos os campos antes de processar.";
      return;
    }

    const finalValue = method === "Pix" ? value * 0.9 : value;
    const status = method === "Dinheiro" ? "Aprovado" : (Math.random() < 0.9 ? "Aprovado" : "Recusado");

    transactions.unshift({
      id: order.padStart(3, "0"),
      method,
      value: finalValue,
      status,
      time: "agora",
    });

    result.style.color = status === "Aprovado" ? "var(--green)" : "var(--red)";
    result.textContent = `Pedido #${order} -> ${status} (${brl(finalValue)})`;
    renderTransactions(container);
  }

  function toggleToken(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Ver" : "Ocultar";
  }

  async function copyCode(button) {
    const code = button.parentElement.querySelector("code")?.innerText || "";
    await navigator.clipboard.writeText(code);
    const original = button.textContent;
    button.textContent = "Copiado";
    setTimeout(() => { button.textContent = original; }, 1200);
  }

  function exportReport(button) {
    const original = button.textContent;
    button.textContent = "Exportado";
    setTimeout(() => { button.textContent = original; }, 1400);
  }

  function bindView(container) {
    renderTransactions(container);

    container.querySelector("[data-action='simulate-payment']")
      ?.addEventListener("click", () => simulatePayment(container));

    container.querySelectorAll("[data-action='toggle-token']").forEach((button) => {
      button.addEventListener("click", () => toggleToken(button.dataset.target, button));
    });

    container.querySelectorAll("[data-action='copy-code']").forEach((button) => {
      button.addEventListener("click", () => copyCode(button));
    });

    container.querySelectorAll("[data-action='export-report']").forEach((button) => {
      button.addEventListener("click", () => exportReport(button));
    });
  }

  return { bindView };
})();
