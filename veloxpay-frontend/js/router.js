const VeloxPayRouter = (() => {
  const routes = {
    dashboard: { title: "Dashboard", crumb: "/ visão geral", file: "dashboard.html" },
    transacoes: { title: "Transações", crumb: "/ pagamentos", file: "transacoes.html" },
    "novo-pagamento": { title: "Novo Pagamento", crumb: "/ checkout", file: "novo-pagamento.html" },
    relatorios: { title: "Relatórios", crumb: "/ análise", file: "relatorios.html" },
    metodos: { title: "Métodos", crumb: "/ métodos de pagamento", file: "metodos.html" },
    "api-docs": { title: "API & Docs", crumb: "/ desenvolvedores", file: "api-docs.html" },
    configuracoes: { title: "Configurações", crumb: "/ sistema", file: "configuracoes.html" },
  };

  const defaultView = "dashboard";
  let lastFocusTarget = null;

  function getContainer() {
    return document.getElementById("viewContainer");
  }

  function setHeading(viewName) {
    const route = routes[viewName] || routes[defaultView];
    document.getElementById("viewTitle").textContent = route.title;
    document.getElementById("viewCrumb").textContent = route.crumb;
  }

  function setActive(viewName) {
    document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });
  }

  async function loadView(viewName = defaultView, focusTarget = null) {
    const route = routes[viewName] || routes[defaultView];
    const container = getContainer();
    const normalizedView = routes[viewName] ? viewName : defaultView;

    lastFocusTarget = focusTarget;
    setActive(normalizedView);
    setHeading(normalizedView);
    container.innerHTML = '<div class="view-loading">Carregando módulo...</div>';

    try {
      const response = await fetch(`views/${route.file}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Falha ao carregar ${route.file}`);
      }

      container.innerHTML = await response.text();
      window.location.hash = normalizedView;
      VeloxPaySimulator.bindView(container);

      if (lastFocusTarget) {
        const target = container.querySelector(`[data-section="${lastFocusTarget}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      container.innerHTML = `<div class="view-error">${error.message}</div>`;
    }
  }

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-view]");
      if (!trigger) return;

      event.preventDefault();
      loadView(trigger.dataset.view, trigger.dataset.focus || null);
    });
  }

  function init() {
    bindNavigation();
    const initial = window.location.hash.replace("#", "") || defaultView;
    loadView(routes[initial] ? initial : defaultView);
  }

  return { init, loadView };
})();
