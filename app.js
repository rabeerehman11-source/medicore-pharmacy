// ===== MEDICORE PHARMACY APP =====

// DATA is defined in data.js (Supabase-backed). Don't redeclare it here.
let VIEW = "checking"; // checking | landing | login | app
let LOADING = false;
let STATE = {
  page: "dashboard",
  activeBranch: "all", // "all" or branch id
  invSearch: "",
  invFilter: "all", // all | low | expiring
  empSearch: "",
};

const $app = document.getElementById("app");

function initials(name){
  return name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
}

function fmtMoney(n){
  return "Rs " + Math.round(n).toLocaleString("en-PK");
}

function daysUntil(dateStr){
  const today = new Date("2026-06-21");
  const d = new Date(dateStr);
  return Math.round((d - today) / (1000*60*60*24));
}

function showToast(msg, icon="ti-check"){
  const t = document.getElementById("toast");
  t.innerHTML = `<i class="ti ${icon}"></i> ${msg}`;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=> t.classList.remove("show"), 2600);
}

function closeModal(){
  document.getElementById("modalOverlay").classList.remove("open");
}

function openModal(html){
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modalOverlay").classList.add("open");
}

document.getElementById("modalOverlay").addEventListener("click", (e)=>{
  if(e.target.id === "modalOverlay") closeModal();
});

// ---------- stock helpers ----------
function totalStock(p){
  return Object.values(p.stock).reduce((a,b)=>a+b,0);
}
function stockForBranch(p, branchId){
  if(branchId === "all") return totalStock(p);
  return p.stock[branchId] || 0;
}
function stockStatus(qty, reorder){
  if(qty === 0) return "out";
  if(qty <= reorder) return "low";
  return "ok";
}
function branchHealth(branchId){
  const items = DATA.products;
  let ok=0, low=0, out=0;
  items.forEach(p=>{
    const q = p.stock[branchId] || 0;
    const s = stockStatus(q, p.reorderLevel);
    if(s==="ok") ok++; else if(s==="low") low++; else out++;
  });
  return {ok, low, out, total: items.length};
}

// ---------- NAV CONFIG ----------
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"ti-layout-dashboard" },
  { id:"pos", label:"Point of Sale", icon:"ti-cash-register" },
  { id:"branches", label:"Branches", icon:"ti-building-store" },
  { id:"inventory", label:"Inventory", icon:"ti-boxes" },
  { id:"sales", label:"Sales", icon:"ti-receipt" },
  { id:"purchases", label:"Purchases", icon:"ti-truck-delivery" },
  { id:"transfers", label:"Stock transfers", icon:"ti-arrows-exchange" },
  { id:"suppliers", label:"Suppliers", icon:"ti-truck" },
  { id:"profit", label:"Profit & expenses", icon:"ti-chart-pie" },
  { id:"attendance", label:"Attendance", icon:"ti-clock-check" },
  { id:"employees", label:"Employees", icon:"ti-users" },
  { id:"assistant", label:"AI assistant", icon:"ti-sparkles" },
];

function render(){
  if(VIEW === "checking") return renderChecking();
  if(VIEW === "landing") return renderLanding();
  if(VIEW === "login") return renderLogin();
  renderAppShell();
}

function renderChecking(){
  $app.innerHTML = `
    <div class="login-shell">
      <div style="display:flex; flex-direction:column; align-items:center; gap:14px; color:var(--ink-soft);">
        <div class="gate-brand-mark" style="width:40px; height:40px; font-size:18px;">M</div>
        <div style="font-size:13.5px;">Loading MediCore...</div>
      </div>
    </div>
  `;
}

function renderAppShell(){
  const branchOptions = `<option value="all">All branches</option>` +
    DATA.branches.map(b=>`<option value="${b.id}" ${STATE.activeBranch===b.id?"selected":""}>${b.name}</option>`).join("");

  $app.innerHTML = `
    <div class="sidebar">
      <div class="brand">
        <div class="brand-mark">M</div>
        <div class="brand-name">MediCore</div>
        <div class="brand-sub">Pharmacy ERP</div>
      </div>
      <div class="branch-picker">
        <div class="branch-label">Viewing</div>
        <select class="branch-select" id="branchSelect">${branchOptions}</select>
      </div>
      <div class="nav">
        ${NAV.map(n=>`
          <div class="nav-item ${STATE.page===n.id?'active':''}" data-page="${n.id}">
            <i class="ti ${n.icon}"></i> ${n.label}
            ${n.id==='inventory' && lowStockCount()>0 ? `<span class="badge-count">${lowStockCount()}</span>` : ''}
          </div>`).join("")}
      </div>
      <div class="sidebar-foot" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Demo data</span>
        <span id="logoutLink" style="cursor:pointer; text-decoration:underline;">Sign out</span>
      </div>
    </div>
    <div class="main">
      ${renderTopbar()}
      <div class="content" id="contentArea">${renderPage()}</div>
    </div>
  `;
  attachGlobalHandlers();
  attachPageHandlers();
}

function lowStockCount(){
  let c = 0;
  DATA.products.forEach(p=>{
    const q = stockForBranch(p, STATE.activeBranch);
    if(stockStatus(q, p.reorderLevel) !== "ok") c++;
  });
  return c;
}

function renderTopbar(){
  const titles = {
    dashboard: ["Dashboard", "Overview across all branches"],
    pos: ["Point of Sale", "Search, scan, and check out"],
    branches: ["Branches", "Manage your pharmacy locations"],
    inventory: ["Inventory", "Stock levels, batches, and expiry"],
    sales: ["Sales", "Record sales and track revenue"],
    purchases: ["Purchases", "Record incoming stock from suppliers"],
    transfers: ["Stock transfers", "Move stock between branches"],
    suppliers: ["Suppliers", "Vendors you order stock from"],
    profit: ["Profit & expenses", "Track costs and see real net profit per branch"],
    attendance: ["Attendance", "Check-in times and leave records"],
    employees: ["Employees", "Staff across all branches"],
    assistant: ["AI assistant", "Ask about stock, staff, or branches in plain English"],
  };
  const [title, sub] = titles[STATE.page];
  let actions = "";
  if(STATE.page === "inventory") actions = `<button class="btn btn-primary" id="addProductBtn"><i class="ti ti-plus"></i> Add product</button>`;
  if(STATE.page === "employees") actions = `<button class="btn btn-primary" id="addEmployeeBtn"><i class="ti ti-plus"></i> Add employee</button>`;
  if(STATE.page === "branches") actions = `<button class="btn btn-primary" id="addBranchBtn"><i class="ti ti-plus"></i> Add branch</button>`;
  if(STATE.page === "sales") actions = `<button class="btn btn-primary" id="newSaleBtn"><i class="ti ti-plus"></i> New sale</button>`;
  if(STATE.page === "purchases") actions = `<button class="btn btn-primary" id="newPurchaseBtn"><i class="ti ti-plus"></i> New purchase</button>`;
  if(STATE.page === "transfers") actions = `<button class="btn btn-primary" id="newTransferBtn"><i class="ti ti-plus"></i> New transfer</button>`;
  if(STATE.page === "suppliers") actions = `<button class="btn btn-primary" id="addSupplierBtn"><i class="ti ti-plus"></i> Add supplier</button>`;
  if(STATE.page === "profit") actions = `<button class="btn btn-primary" id="addExpenseBtn"><i class="ti ti-plus"></i> Add expense</button>`;
  if(STATE.page === "attendance") actions = `<button class="btn btn-primary" id="checkInOutBtn"><i class="ti ti-clock-check"></i> Check in / out</button>`;

  return `
    <div class="topbar">
      <div>
        <div class="page-title">${title}</div>
        <div class="page-sub">${sub}</div>
      </div>
      <div class="topbar-actions">${actions}</div>
    </div>
  `;
}

function attachGlobalHandlers(){
  document.querySelectorAll(".nav-item").forEach(el=>{
    el.addEventListener("click", ()=>{
      STATE.page = el.dataset.page;
      render();
    });
  });
  const bs = document.getElementById("branchSelect");
  if(bs){
    bs.addEventListener("change", (e)=>{
      STATE.activeBranch = e.target.value;
      render();
    });
  }
  const logout = document.getElementById("logoutLink");
  if(logout){
    logout.addEventListener("click", async ()=>{
      await supabaseClient.auth.signOut();
      VIEW = "landing";
      render();
    });
  }
}

// ===================== PAGE ROUTER =====================
function renderPage(){
  switch(STATE.page){
    case "dashboard": return renderDashboard();
    case "pos": return renderPOS();
    case "branches": return renderBranches();
    case "inventory": return renderInventory();
    case "sales": return renderSales();
    case "purchases": return renderPurchases();
    case "transfers": return renderTransfers();
    case "suppliers": return renderSuppliers();
    case "profit": return renderProfit();
    case "attendance": return renderAttendance();
    case "employees": return renderEmployees();
    case "assistant": return renderAssistant();
    default: return "";
  }
}

function attachPageHandlers(){
  switch(STATE.page){
    case "dashboard": attachDashboardHandlers(); break;
    case "pos": attachPOSHandlers(); break;
    case "branches": attachBranchHandlers(); break;
    case "inventory": attachInventoryHandlers(); break;
    case "sales": attachSalesHandlers(); break;
    case "purchases": attachPurchasesHandlers(); break;
    case "transfers": attachTransfersHandlers(); break;
    case "suppliers": attachSuppliersHandlers(); break;
    case "profit": attachProfitHandlers(); break;
    case "attendance": attachAttendanceHandlers(); break;
    case "employees": attachEmployeeHandlers(); break;
    case "assistant": attachAssistantHandlers(); break;
  }
}

// ===================== POINT OF SALE =====================
let POS_CART = []; // [{ productId, quantity }]
let POS_SEARCH = "";

function renderPOS(){
  if(DATA.branches.length === 0){
    return `<div class="empty-state"><i class="ti ti-building-store"></i>Add a branch before using the POS screen</div>`;
  }
  const branchId = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
  const branch = DATA.branches.find(b=>b.id===branchId);

  const q = POS_SEARCH.trim().toLowerCase();
  let products = DATA.products;
  if(q){
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  }

  const productCards = products.slice(0,60).map(p=>{
    const stock = p.stock[branchId] || 0;
    const outOfStock = stock === 0;
    return `
      <div class="pos-card ${outOfStock?'out-of-stock':''}" data-pos-add="${p.id}" title="${outOfStock?'Out of stock at this branch':'Click to add to cart'}">
        <div class="pos-card-name">${p.name}</div>
        <div class="pos-card-meta">${p.category}${p.barcode ? ' &middot; <span class="mono">'+p.barcode+'</span>' : ''}</div>
        <div class="pos-card-price">${fmtMoney(p.unitPrice)}</div>
        <div class="pos-card-stock">${outOfStock ? 'Out of stock' : stock + ' in stock'}</div>
      </div>
    `;
  }).join("");

  const cartRows = POS_CART.map(item=>{
    const p = DATA.products.find(x=>x.id===item.productId);
    if(!p) return "";
    const stock = p.stock[branchId] || 0;
    const lineTotal = item.quantity * p.unitPrice;
    return `
      <div class="pos-cart-row">
        <div style="flex:1;">
          <div class="pos-cart-row-name">${p.name}</div>
          <div class="pos-cart-row-sub">${fmtMoney(p.unitPrice)} each &middot; ${stock} available</div>
        </div>
        <div class="pos-qty-control">
          <div class="pos-qty-btn" data-pos-dec="${p.id}">−</div>
          <div class="pos-qty-val">${item.quantity}</div>
          <div class="pos-qty-btn" data-pos-inc="${p.id}">+</div>
        </div>
        <div class="pos-cart-row-total">${fmtMoney(lineTotal)}</div>
        <div class="pos-remove-btn" data-pos-remove="${p.id}"><i class="ti ti-x"></i></div>
      </div>
    `;
  }).join("");

  const subtotal = POS_CART.reduce((s,item)=>{
    const p = DATA.products.find(x=>x.id===item.productId);
    return s + (p ? item.quantity*p.unitPrice : 0);
  }, 0);
  const itemCount = POS_CART.reduce((s,i)=>s+i.quantity,0);

  return `
    <div class="pos-shell">
      <div style="display:flex; flex-direction:column;">
        <div class="pos-search-bar">
          <input class="pos-search-input" id="posSearchInput" placeholder="Scan barcode (auto-adds to cart) or type a product name..." value="${POS_SEARCH}" autofocus>
        </div>
        <div class="pos-grid">
          ${productCards || `<div class="empty-state" style="grid-column:1/-1;"><i class="ti ti-search-off"></i>No products match</div>`}
        </div>
      </div>
      <div class="pos-cart-panel">
        <div class="pos-cart-head">Current sale</div>
        <div class="pos-cart-sub">${branch.name.replace("MediCore — ","")} &middot; ${itemCount} item${itemCount===1?'':'s'}</div>
        <div class="pos-cart-items">
          ${cartRows || `<div class="pos-cart-empty"><i class="ti ti-shopping-cart" style="font-size:24px; opacity:0.4; display:block; margin-bottom:8px;"></i>Cart is empty — click a product to add it</div>`}
        </div>
        <input class="pos-customer-input" id="posCustomerName" placeholder="Customer name (optional)">
        <div class="pos-totals">
          <div class="pos-total-row grand"><span>Total</span><span>${fmtMoney(subtotal)}</span></div>
        </div>
        <button class="btn btn-primary btn-lg" style="width:100%; justify-content:center; margin-top:12px;" id="posCheckoutBtn" ${POS_CART.length===0?'disabled':''}>
          <i class="ti ti-receipt"></i> Checkout
        </button>
      </div>
    </div>
  `;
}

function attachPOSHandlers(){
  const search = document.getElementById("posSearchInput");
  if(search){
    search.addEventListener("input", (e)=>{ POS_SEARCH = e.target.value; renderPOSInPlace(); });
    search.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      // USB barcode scanners type the code then send Enter automatically.
      // If the scanned text matches exactly one product's barcode, add it
      // straight to the cart instead of just leaving it filtered in the grid.
      const scanned = search.value.trim();
      if(!scanned) return;
      const branchId = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
      const matches = DATA.products.filter(p => p.barcode && p.barcode === scanned);
      if(matches.length === 1){
        const p = matches[0];
        const stock = p.stock[branchId] || 0;
        if(stock === 0){ showToast(`${p.name} is out of stock at this branch`, "ti-alert-circle"); }
        else{
          const existing = POS_CART.find(i=>i.productId===p.id);
          if(existing){
            if(existing.quantity < stock) existing.quantity++;
            else showToast("No more stock available", "ti-alert-circle");
          }else{
            POS_CART.push({ productId: p.id, quantity: 1 });
          }
          showToast(`${p.name} added to cart`);
        }
        POS_SEARCH = "";
        renderPOSInPlace();
      }
      // If it's not an exact barcode match, leave it as a normal text search
      // (e.g. someone typed a partial name) — the grid below already filters live.
    });
    setTimeout(()=>{ search.focus(); search.setSelectionRange(search.value.length, search.value.length); }, 0);
  }
  document.querySelectorAll("[data-pos-add]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const productId = el.dataset.posAdd;
      const branchId = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
      const p = DATA.products.find(x=>x.id===productId);
      const stock = p ? (p.stock[branchId]||0) : 0;
      if(stock === 0){ showToast("Out of stock at this branch", "ti-alert-circle"); return; }
      const existing = POS_CART.find(i=>i.productId===productId);
      if(existing){
        if(existing.quantity >= stock){ showToast("No more stock available", "ti-alert-circle"); return; }
        existing.quantity++;
      }else{
        POS_CART.push({ productId, quantity: 1 });
      }
      renderPOSInPlace();
    });
  });
  document.querySelectorAll("[data-pos-inc]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const productId = el.dataset.posInc;
      const branchId = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
      const p = DATA.products.find(x=>x.id===productId);
      const stock = p ? (p.stock[branchId]||0) : 0;
      const item = POS_CART.find(i=>i.productId===productId);
      if(item.quantity >= stock){ showToast("No more stock available", "ti-alert-circle"); return; }
      item.quantity++;
      renderPOSInPlace();
    });
  });
  document.querySelectorAll("[data-pos-dec]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const productId = el.dataset.posDec;
      const item = POS_CART.find(i=>i.productId===productId);
      item.quantity--;
      if(item.quantity <= 0) POS_CART = POS_CART.filter(i=>i.productId!==productId);
      renderPOSInPlace();
    });
  });
  document.querySelectorAll("[data-pos-remove]").forEach(el=>{
    el.addEventListener("click", ()=>{
      POS_CART = POS_CART.filter(i=>i.productId!==el.dataset.posRemove);
      renderPOSInPlace();
    });
  });
  const checkoutBtn = document.getElementById("posCheckoutBtn");
  if(checkoutBtn) checkoutBtn.addEventListener("click", doPOSCheckout);
}

function renderPOSInPlace(){
  document.getElementById("contentArea").innerHTML = renderPage();
  attachPageHandlers();
}

async function doPOSCheckout(){
  if(POS_CART.length === 0) return;
  const branchId = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
  const customerName = document.getElementById("posCustomerName").value.trim() || "Walk-in";
  const cart = POS_CART.map(item=>{
    const p = DATA.products.find(x=>x.id===item.productId);
    return { productId: item.productId, quantity: item.quantity, unitPrice: p.unitPrice };
  });

  const btn = document.getElementById("posCheckoutBtn");
  btn.disabled = true;
  btn.innerHTML = `<i class="ti ti-loader-2"></i> Processing...`;

  try{
    await dbRecordPosSale({ branchId, customerName, cart });
    const receiptData = {
      branchName: DATA.branches.find(b=>b.id===branchId).name,
      customerName,
      items: cart.map(c=>({ name: DATA.products.find(p=>p.id===c.productId).name, ...c })),
      total: cart.reduce((s,c)=>s+c.quantity*c.unitPrice,0),
      date: new Date()
    };
    await fetchAllData();
    POS_CART = [];
    showReceiptModal(receiptData);
    showToast("Sale completed — stock updated");
    render();
  }catch(err){
    showToast(err.message || "Checkout failed", "ti-alert-circle");
    btn.disabled = false;
    btn.innerHTML = `<i class="ti ti-receipt"></i> Checkout`;
  }
}

function showReceiptModal(receipt){
  const itemRows = receipt.items.map(i=>`
    <div class="receipt-item-row">
      <span>${i.name} x${i.quantity}</span>
      <span>${fmtMoney(i.quantity*i.unitPrice)}</span>
    </div>
  `).join("");
  openModal(`
    <div class="receipt-wrap">
      <div class="receipt-head">
        <div class="brand">MediCore</div>
        <div>${receipt.branchName}</div>
        <div>${receipt.date.toLocaleDateString("en-GB")} ${receipt.date.toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-line"><span>Customer</span><span>${receipt.customerName}</span></div>
      <div class="receipt-divider"></div>
      ${itemRows}
      <div class="receipt-divider"></div>
      <div class="receipt-total"><span>TOTAL</span><span>${fmtMoney(receipt.total)}</span></div>
      <div class="receipt-divider"></div>
      <div style="text-align:center; font-size:11px; color:var(--ink-soft); margin-top:6px;">Thank you for shopping with MediCore</div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="window.print()"><i class="ti ti-printer"></i> Print receipt</button>
    </div>
  `);
}

// ===================== DASHBOARD =====================
function renderDashboard(){
  const scopeProducts = DATA.products;
  const totalValue = scopeProducts.reduce((sum,p)=> sum + stockForBranch(p, STATE.activeBranch) * p.unitPrice, 0);
  const lowCount = scopeProducts.filter(p => stockStatus(stockForBranch(p, STATE.activeBranch), p.reorderLevel) === "low").length;
  const outCount = scopeProducts.filter(p => stockStatus(stockForBranch(p, STATE.activeBranch), p.reorderLevel) === "out").length;
  const empCount = STATE.activeBranch==="all" ? DATA.employees.length : DATA.employees.filter(e=>e.branch===STATE.activeBranch).length;

  const scopedSales = STATE.activeBranch==="all" ? DATA.sales : DATA.sales.filter(s=>s.branchId===STATE.activeBranch);
  const scopedPurchases = STATE.activeBranch==="all" ? DATA.purchases : DATA.purchases.filter(p=>p.branchId===STATE.activeBranch);

  const now = new Date("2026-06-21");
  const isSameDay = (iso) => new Date(iso).toDateString() === now.toDateString();
  const isSameMonth = (iso) => { const d = new Date(iso); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); };

  const todaySales = scopedSales.filter(s=>isSameDay(s.createdAt));
  const todayRevenue = todaySales.reduce((s,x)=>s+x.quantity*x.unitPrice,0);

  const monthSales = scopedSales.filter(s=>isSameMonth(s.createdAt));
  const monthRevenue = monthSales.reduce((s,x)=>s+x.quantity*x.unitPrice,0);

  // Profit estimation: use each product's average purchase cost as COGS where we have
  // purchase history for it; fall back to an assumed 30% margin (typical pharmacy retail
  // markup) for products never purchased through the system yet — this is an ESTIMATE,
  // not an accounting-grade figure, and the dashboard labels it as such.
  const avgCostByProduct = {};
  DATA.purchases.forEach(p=>{
    if(!avgCostByProduct[p.productId]) avgCostByProduct[p.productId] = { total:0, qty:0 };
    avgCostByProduct[p.productId].total += p.unitCost * p.quantity;
    avgCostByProduct[p.productId].qty += p.quantity;
  });
  function estCost(productId, fallbackPrice){
    const rec = avgCostByProduct[productId];
    if(rec && rec.qty > 0) return rec.total / rec.qty;
    return fallbackPrice * 0.7; // assume 30% margin if no purchase history
  }
  const monthProfit = monthSales.reduce((s,x)=>{
    const cost = estCost(x.productId, x.unitPrice);
    return s + (x.unitPrice - cost) * x.quantity;
  }, 0);

  const expiringSoon = scopeProducts
    .map(p=>({...p, days: daysUntil(p.expiry)}))
    .filter(p=>p.days <= 120)
    .sort((a,b)=>a.days-b.days)
    .slice(0,5);

  const expiring30 = scopeProducts.map(p=>({...p, days: daysUntil(p.expiry)})).filter(p=>p.days <= 30 && p.days >= 0);

  const criticalStock = scopeProducts
    .map(p=>({...p, qty: stockForBranch(p, STATE.activeBranch)}))
    .filter(p=> stockStatus(p.qty, p.reorderLevel) !== "ok")
    .sort((a,b)=>a.qty-b.qty)
    .slice(0,5);

  // Top sellers by revenue, for the chart
  const revenueByProduct = {};
  scopedSales.forEach(s=>{
    revenueByProduct[s.productId] = (revenueByProduct[s.productId]||0) + s.quantity*s.unitPrice;
  });
  const topSellers = Object.entries(revenueByProduct)
    .map(([pid,rev])=>({ name: (DATA.products.find(p=>p.id===pid)||{}).name || "Unknown", revenue: rev }))
    .sort((a,b)=>b.revenue-a.revenue)
    .slice(0,6);
  const maxTopRevenue = Math.max(1, ...topSellers.map(t=>t.revenue));

  return `
    <div class="metric-row">
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-receipt"></i> Sales today</div>
        <div class="metric-value">${fmtMoney(todayRevenue)}</div>
        <div class="metric-delta up">${todaySales.length} transaction${todaySales.length===1?'':'s'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-calendar-stats"></i> Monthly revenue</div>
        <div class="metric-value">${fmtMoney(monthRevenue)}</div>
        <div class="metric-delta up">${monthSales.length} sales this month</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-chart-line"></i> Est. profit (month)</div>
        <div class="metric-value" style="color:var(--teal-700);">${fmtMoney(monthProfit)}</div>
        <div class="metric-delta up">Estimated, based on cost data</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-currency-rupee"></i> Inventory value</div>
        <div class="metric-value">${fmtMoney(totalValue)}</div>
        <div class="metric-delta up">Across ${STATE.activeBranch==='all' ? DATA.branches.length+' branches' : 'this branch'}</div>
      </div>
    </div>
    <div class="metric-row">
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-alert-triangle"></i> Low or out of stock</div>
        <div class="metric-value" style="color:${lowCount+outCount>0?'var(--amber-600)':'inherit'}">${lowCount+outCount}</div>
        <div class="metric-delta ${lowCount+outCount>0?'down':'up'}">${outCount} out &middot; ${lowCount} low</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-calendar-exclamation"></i> Expiring in 30 days</div>
        <div class="metric-value" style="color:${expiring30.length>0?'var(--red-500)':'inherit'}">${expiring30.length}</div>
        <div class="metric-delta ${expiring30.length>0?'down':'up'}">Needs review</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-boxes"></i> Products tracked</div>
        <div class="metric-value">${scopeProducts.length}</div>
        <div class="metric-delta up">SKUs in catalogue</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-users"></i> Staff</div>
        <div class="metric-value">${empCount}</div>
        <div class="metric-delta up">${DATA.employees.filter(e=>e.status==='Active').length} active total</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:20px; margin-bottom:8px;">
      <div>
        <div class="section-head">
          <div class="section-title">Top selling medicines</div>
          <div class="section-link" data-goto="sales">View all sales →</div>
        </div>
        <div class="card">
          ${topSellers.length === 0 ? `<div class="empty-state"><i class="ti ti-chart-bar"></i>No sales recorded yet</div>` :
          topSellers.map(t=>`
            <div style="margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px;">
                <span style="font-weight:500;">${t.name}</span>
                <span class="mono" style="color:var(--ink-soft);">${fmtMoney(t.revenue)}</span>
              </div>
              <div style="height:8px; background:var(--paper-dim); border-radius:4px; overflow:hidden;">
                <div style="height:100%; width:${(t.revenue/maxTopRevenue*100).toFixed(1)}%; background:var(--teal-600); border-radius:4px;"></div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      <div>
        <div class="section-head">
          <div class="section-title">Branch performance</div>
          <div class="section-link" data-goto="branches">View all branches →</div>
        </div>
        <div class="card" style="padding:0; overflow:hidden;">
          <table>
            <thead><tr><th>Branch</th><th>Revenue</th><th>Sales</th></tr></thead>
            <tbody>
              ${DATA.branches.map(b=>{
                const bSales = DATA.sales.filter(s=>s.branchId===b.id);
                const bRevenue = bSales.reduce((s,x)=>s+x.quantity*x.unitPrice,0);
                return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${fmtMoney(bRevenue)}</td><td class="mono">${bSales.length}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="section-head">
      <div class="section-title">Branch health</div>
      <div class="section-link" data-goto="branches">View all branches →</div>
    </div>
    <div class="branch-grid">
      ${DATA.branches.map(b=>renderBranchCard(b)).join("")}
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div>
        <div class="section-head">
          <div class="section-title">Needs attention</div>
          <div class="section-link" data-goto="inventory">View inventory →</div>
        </div>
        <div class="card">
          ${criticalStock.length === 0 ? `<div class="empty-state"><i class="ti ti-circle-check"></i>All stock levels look healthy</div>` :
          criticalStock.map((p,i)=>`
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; ${i<criticalStock.length-1?'border-bottom:1px solid var(--line);':''}">
              <div>
                <div class="tname">${p.name}</div>
                <div class="tsub">${p.category}</div>
              </div>
              <div style="text-align:right;">
                <span class="tag ${p.qty===0?'tag-out':'tag-low'}">${p.qty===0?'Out of stock':p.qty+' left'}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      <div>
        <div class="section-head">
          <div class="section-title">Expiring soon</div>
          <div class="section-link" data-goto="inventory">View inventory →</div>
        </div>
        <div class="card">
          ${expiringSoon.length === 0 ? `<div class="empty-state"><i class="ti ti-calendar-check"></i>Nothing expiring in the next 4 months</div>` :
          expiringSoon.map(p=>`
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--line);">
              <div>
                <div class="tname">${p.name}</div>
                <div class="tsub mono">Batch ${p.batch}</div>
              </div>
              <div style="text-align:right;">
                <span class="tag ${p.days<60?'tag-exp':'tag-low'}">${p.days} days</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    <div style="margin-top:24px; background:var(--teal-50); border:1px solid var(--teal-100); border-radius:var(--radius); padding:18px 22px; display:flex; align-items:center; gap:16px;">
      <div style="width:40px; height:40px; border-radius:9px; background:var(--amber-500); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <i class="ti ti-sparkles" style="color:var(--teal-900); font-size:19px;"></i>
      </div>
      <div style="flex:1;">
        <div style="font-weight:500; font-size:14px;">Ask the AI assistant</div>
        <div style="font-size:12.5px; color:var(--ink-soft);">"Which branch needs Amoxil restocked?" or "What's our top seller this month?"</div>
      </div>
      <button class="btn btn-primary" data-goto="assistant">Open assistant</button>
    </div>
  `;
}

function renderBranchCard(b){
  const h = branchHealth(b.id);
  const segs = Array.from({length:10}, (_,i)=>{
    const pct = h.total ? (h.ok/h.total) : 1;
    const filled = i < Math.round(pct*10);
    let color = "var(--teal-600)";
    if(h.out > h.low + 1) color = "var(--red-500)";
    else if(h.low > 2) color = "var(--amber-500)";
    return `<div class="pulse-seg" style="height:${filled? (40+i*5)+'%':'100%'}; background:${filled?color:'var(--line)'}"></div>`;
  }).join("");
  const overall = h.out > 0 ? "bad" : (h.low > 2 ? "warn" : "good");
  const overallLabel = h.out > 0 ? `${h.out} out of stock` : (h.low > 2 ? `${h.low} running low` : "Healthy");
  const empCount = DATA.employees.filter(e=>e.branch===b.id).length;

  return `
    <div class="branch-card" data-branch-detail="${b.id}">
      <div class="branch-card-top">
        <div>
          <div class="branch-card-name">${b.name.replace("MediCore — ","")}</div>
          <div class="branch-card-loc">${b.city}</div>
        </div>
        <span class="status-pill status-${overall}">${overallLabel}</span>
      </div>
      <div class="pulse-bar">${segs}</div>
      <div class="branch-stats">
        <span>${empCount} staff</span>
        <span>${h.total} SKUs</span>
        <span>Mgr: ${b.manager.split(" ")[0]}</span>
      </div>
    </div>
  `;
}

function attachDashboardHandlers(){
  document.querySelectorAll("[data-goto]").forEach(el=>{
    el.addEventListener("click", ()=>{ STATE.page = el.dataset.goto; render(); });
  });
  document.querySelectorAll("[data-branch-detail]").forEach(el=>{
    el.addEventListener("click", ()=>{
      STATE.activeBranch = el.dataset.branchDetail;
      STATE.page = "inventory";
      render();
    });
  });
}

// ===================== BRANCHES =====================
function renderBranches(){
  return `
    <div class="branch-grid" style="grid-template-columns:repeat(3,1fr);">
      ${DATA.branches.map(b=>{
        const h = branchHealth(b.id);
        const empCount = DATA.employees.filter(e=>e.branch===b.id).length;
        const value = DATA.products.reduce((s,p)=> s + (p.stock[b.id]||0)*p.unitPrice, 0);
        return `
        <div class="card" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
            <div>
              <div class="branch-card-name" style="font-size:18px;">${b.name}</div>
              <div class="branch-card-loc"><i class="ti ti-map-pin" style="font-size:12px; vertical-align:-1px;"></i> ${b.city}</div>
            </div>
            <button class="btn btn-sm" data-edit-branch="${b.id}"><i class="ti ti-edit"></i></button>
          </div>
          <table style="font-size:13px;">
            <tr><td style="color:var(--ink-soft); padding:6px 0;">Manager</td><td style="text-align:right; font-weight:500;">${b.manager}</td></tr>
            <tr><td style="color:var(--ink-soft); padding:6px 0;">Phone</td><td style="text-align:right;" class="mono">${b.phone}</td></tr>
            <tr><td style="color:var(--ink-soft); padding:6px 0;">Opened</td><td style="text-align:right;" class="mono">${b.opened}</td></tr>
            <tr><td style="color:var(--ink-soft); padding:6px 0;">Staff</td><td style="text-align:right; font-weight:500;">${empCount}</td></tr>
            <tr><td style="color:var(--ink-soft); padding:6px 0;">Stock value</td><td style="text-align:right; font-weight:500;" class="mono">${fmtMoney(value)}</td></tr>
          </table>
          <div style="display:flex; gap:8px; margin-top:16px;">
            <button class="btn btn-sm" style="flex:1;" data-view-inv="${b.id}"><i class="ti ti-boxes"></i> Inventory</button>
            <button class="btn btn-sm" style="flex:1;" data-view-emp="${b.id}"><i class="ti ti-users"></i> Staff</button>
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
}

function attachBranchHandlers(){
  const addBtn = document.getElementById("addBranchBtn");
  if(addBtn) addBtn.addEventListener("click", openAddBranchModal);
  document.querySelectorAll("[data-view-inv]").forEach(el=>{
    el.addEventListener("click", ()=>{ STATE.activeBranch = el.dataset.viewInv; STATE.page="inventory"; render(); });
  });
  document.querySelectorAll("[data-view-emp]").forEach(el=>{
    el.addEventListener("click", ()=>{ STATE.activeBranch = el.dataset.viewEmp; STATE.page="employees"; render(); });
  });
  document.querySelectorAll("[data-edit-branch]").forEach(el=>{
    el.addEventListener("click", ()=> openEditBranchModal(el.dataset.editBranch));
  });
}

function openAddBranchModal(){
  openModal(`
    <div class="modal-title">Add a new branch</div>
    <div class="field"><label>Branch name</label><input id="f_name" placeholder="e.g. MediCore — Johar Town"></div>
    <div class="field"><label>City</label><input id="f_city" placeholder="e.g. Lahore"></div>
    <div class="field"><label>Branch manager</label><input id="f_manager" placeholder="Full name"></div>
    <div class="field"><label>Phone</label><input id="f_phone" placeholder="+92 ..."></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBranchBtn">Save branch</button>
    </div>
  `);
  document.getElementById("saveBranchBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("f_name").value.trim();
    const city = document.getElementById("f_city").value.trim();
    const manager = document.getElementById("f_manager").value.trim();
    const phone = document.getElementById("f_phone").value.trim();
    if(!name || !city){ showToast("Please fill in branch name and city", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveBranchBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbAddBranch({ name, city, manager: manager || "Unassigned", phone: phone || "—" });
      await fetchAllData();
      closeModal();
      showToast("Branch added");
      render();
    }catch(err){
      showToast(err.message || "Couldn't save branch", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Save branch";
    }
  });
}

function openEditBranchModal(branchId){
  const b = DATA.branches.find(x=>x.id===branchId);
  openModal(`
    <div class="modal-title">Edit branch</div>
    <div class="field"><label>Branch name</label><input id="f_name" value="${b.name}"></div>
    <div class="field"><label>City</label><input id="f_city" value="${b.city}"></div>
    <div class="field"><label>Branch manager</label><input id="f_manager" value="${b.manager}"></div>
    <div class="field"><label>Phone</label><input id="f_phone" value="${b.phone}"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBranchBtn">Save changes</button>
    </div>
  `);
  document.getElementById("saveBranchBtn").addEventListener("click", async ()=>{
    const fields = {
      name: document.getElementById("f_name").value.trim() || b.name,
      city: document.getElementById("f_city").value.trim() || b.city,
      manager: document.getElementById("f_manager").value.trim() || b.manager,
      phone: document.getElementById("f_phone").value.trim() || b.phone,
    };
    const btn = document.getElementById("saveBranchBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbUpdateBranch(branchId, fields);
      await fetchAllData();
      closeModal();
      showToast("Branch updated");
      render();
    }catch(err){
      showToast(err.message || "Couldn't update branch", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Save changes";
    }
  });
}

// ===================== INVENTORY =====================
function renderInventory(){
  let items = DATA.products.map(p => ({...p, qty: stockForBranch(p, STATE.activeBranch)}));

  if(STATE.invSearch.trim()){
    const q = STATE.invSearch.trim().toLowerCase();
    items = items.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.batch.toLowerCase().includes(q));
  }
  if(STATE.invFilter === "low"){
    items = items.filter(p => stockStatus(p.qty, p.reorderLevel) !== "ok");
  }else if(STATE.invFilter === "expiring"){
    items = items.filter(p => daysUntil(p.expiry) <= 120);
  }

  const rows = items.map(p=>{
    const status = stockStatus(p.qty, p.reorderLevel);
    const tagClass = status === "out" ? "tag-out" : status === "low" ? "tag-low" : "tag-ok";
    const tagLabel = status === "out" ? "Out of stock" : status === "low" ? "Low stock" : "In stock";
    const days = daysUntil(p.expiry);
    const expTag = days <= 60 ? `<span class="tag tag-exp" style="margin-left:6px;">${days}d</span>` : (days <= 120 ? `<span class="tag tag-low" style="margin-left:6px;">${days}d</span>` : "");
    return `
      <tr>
        <td>
          <div class="tname">${p.name}</div>
          <div class="tsub">${p.category}</div>
        </td>
        <td class="mono">${p.batch}</td>
        <td class="mono">${p.expiry} ${expTag}</td>
        <td class="mono">${fmtMoney(p.unitPrice)}</td>
        <td class="mono" style="font-weight:500;">${p.qty}</td>
        <td><span class="tag ${tagClass}">${tagLabel}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-sm" data-adjust-stock="${p.id}"><i class="ti ti-edit"></i> Adjust</button>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="toolbar">
      <input class="search-input" id="invSearchInput" placeholder="Search by product, category, or batch..." value="${STATE.invSearch}">
      <div style="display:flex; gap:8px;">
        <div class="filter-chip ${STATE.invFilter==='all'?'active':''}" data-filter="all">All</div>
        <div class="filter-chip ${STATE.invFilter==='low'?'active':''}" data-filter="low">Low / out</div>
        <div class="filter-chip ${STATE.invFilter==='expiring'?'active':''}" data-filter="expiring">Expiring soon</div>
      </div>
    </div>
    <div class="card" style="padding:0; overflow:hidden;">
      ${items.length === 0 ? `<div class="empty-state"><i class="ti ti-search-off"></i>No products match your search</div>` : `
      <table>
        <thead>
          <tr>
            <th>Product</th><th>Batch</th><th>Expiry</th><th>Unit price</th><th>Stock${STATE.activeBranch!=='all'?'':' (all branches)'}</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
  `;
}

function attachInventoryHandlers(){
  const search = document.getElementById("invSearchInput");
  if(search){
    search.addEventListener("input", (e)=>{ STATE.invSearch = e.target.value; renderInPlace(); });
    setTimeout(()=> search.focus(), 0);
  }
  document.querySelectorAll("[data-filter]").forEach(el=>{
    el.addEventListener("click", ()=>{ STATE.invFilter = el.dataset.filter; render(); });
  });
  const addBtn = document.getElementById("addProductBtn");
  if(addBtn) addBtn.addEventListener("click", openAddProductModal);
  document.querySelectorAll("[data-adjust-stock]").forEach(el=>{
    el.addEventListener("click", ()=> openAdjustStockModal(el.dataset.adjustStock));
  });
}

// Lightweight re-render that preserves input focus while typing in search
function renderInPlace(){
  document.getElementById("contentArea").innerHTML = renderPage();
  attachPageHandlers();
  const search = document.getElementById("invSearchInput");
  if(search){
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}

function openAdjustStockModal(productId){
  const p = DATA.products.find(x=>x.id===productId);
  const branchRows = DATA.branches.map(b=>`
    <div class="field" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <label style="margin:0; flex:1;">${b.name.replace("MediCore — ","")}</label>
      <input type="number" min="0" style="width:90px;" id="stock_${b.id}" value="${p.stock[b.id]||0}">
    </div>
  `).join("");
  openModal(`
    <div class="modal-title">Adjust stock — ${p.name}</div>
    <div style="font-size:12.5px; color:var(--ink-soft); margin-bottom:16px;">Batch ${p.batch} &middot; Reorder level: ${p.reorderLevel} units</div>
    ${branchRows}
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveStockBtn">Save stock levels</button>
    </div>
  `);
  document.getElementById("saveStockBtn").addEventListener("click", async ()=>{
    const updates = DATA.branches.map(b=>{
      const val = parseInt(document.getElementById(`stock_${b.id}`).value, 10);
      return { branchId: b.id, quantity: isNaN(val) ? 0 : Math.max(0, val) };
    });
    const btn = document.getElementById("saveStockBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await Promise.all(updates.map(u => dbSetStock(productId, u.branchId, u.quantity)));
      await fetchAllData();
      closeModal();
      showToast("Stock levels updated");
      render();
    }catch(err){
      showToast(err.message || "Couldn't update stock", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Save stock levels";
    }
  });
}

function openAddProductModal(){
  openModal(`
    <div class="modal-title">Add a product</div>
    <div class="field"><label>Product name</label><input id="f_name" placeholder="e.g. Panadol Extra"></div>
    <div class="field"><label>Category</label><input id="f_category" placeholder="e.g. Pain relief"></div>
    <div class="field"><label>Batch number</label><input id="f_batch" placeholder="e.g. PN2241"></div>
    <div class="field"><label>Barcode (optional)</label><input id="f_barcode" placeholder="e.g. 8901234567890"></div>
    <div class="field"><label>Expiry date</label><input id="f_expiry" type="date"></div>
    <div class="field"><label>Unit price (Rs)</label><input id="f_price" type="number" min="0" placeholder="e.g. 45"></div>
    <div class="field"><label>Reorder level</label><input id="f_reorder" type="number" min="0" placeholder="e.g. 30"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveProductBtn">Add product</button>
    </div>
  `);
  document.getElementById("saveProductBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("f_name").value.trim();
    const category = document.getElementById("f_category").value.trim();
    const batch = document.getElementById("f_batch").value.trim();
    const barcode = document.getElementById("f_barcode").value.trim();
    const expiry = document.getElementById("f_expiry").value;
    const unitPrice = parseFloat(document.getElementById("f_price").value) || 0;
    const reorderLevel = parseInt(document.getElementById("f_reorder").value, 10) || 10;
    if(!name || !category){ showToast("Please fill in product name and category", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveProductBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbAddProduct({ name, category, batch: batch || "—", expiry: expiry || "2027-12-31", unitPrice, reorderLevel, barcode });
      await fetchAllData();
      closeModal();
      showToast("Product added to catalogue");
      render();
    }catch(err){
      showToast(err.message || "Couldn't add product", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Add product";
    }
  });
}

// ===================== SALES =====================
function productSelectOptions(){
  return DATA.products.map(p=>`<option value="${p.id}">${p.name} — Rs ${p.unitPrice}</option>`).join("");
}

function fmtDateTime(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short" }) + " " + d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
}

function renderSales(){
  const scopedSales = STATE.activeBranch === "all" ? DATA.sales : DATA.sales.filter(s=>s.branchId===STATE.activeBranch);
  const totalRevenue = scopedSales.reduce((s,x)=> s + x.quantity*x.unitPrice, 0);
  const todaySales = scopedSales.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue = todaySales.reduce((s,x)=> s + x.quantity*x.unitPrice, 0);

  const productName = (id) => (DATA.products.find(p=>p.id===id)||{}).name || "Unknown product";
  const branchName = (id) => (DATA.branches.find(b=>b.id===id)||{}).name?.replace("MediCore — ","") || "—";

  const rows = scopedSales.slice(0,50).map(s=>`
    <tr>
      <td class="mono">${fmtDateTime(s.createdAt)}</td>
      <td><div class="tname">${productName(s.productId)}</div></td>
      <td>${branchName(s.branchId)}</td>
      <td class="mono">${s.quantity}</td>
      <td class="mono">${fmtMoney(s.unitPrice)}</td>
      <td class="mono" style="font-weight:500;">${fmtMoney(s.quantity*s.unitPrice)}</td>
      <td>${s.customerName}</td>
    </tr>
  `).join("");

  return `
    <div class="metric-row" style="grid-template-columns:repeat(3,1fr);">
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-receipt"></i> Today's revenue</div>
        <div class="metric-value">${fmtMoney(todayRevenue)}</div>
        <div class="metric-delta up">${todaySales.length} sale${todaySales.length===1?'':'s'} today</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-chart-bar"></i> Total revenue logged</div>
        <div class="metric-value">${fmtMoney(totalRevenue)}</div>
        <div class="metric-delta up">${scopedSales.length} transactions</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-building-store"></i> Scope</div>
        <div class="metric-value" style="font-size:16px;">${STATE.activeBranch==='all' ? 'All branches' : branchName(STATE.activeBranch)}</div>
        <div class="metric-delta up">Switch in sidebar</div>
      </div>
    </div>
    <div class="card" style="padding:0; overflow:hidden;">
      ${scopedSales.length === 0 ? `<div class="empty-state"><i class="ti ti-shopping-cart-off"></i>No sales recorded yet — click "New sale" to log one</div>` : `
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>Branch</th><th>Qty</th><th>Unit price</th><th>Total</th><th>Customer</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
  `;
}

function attachSalesHandlers(){
  const btn = document.getElementById("newSaleBtn");
  if(btn) btn.addEventListener("click", openNewSaleModal);
}

function openNewSaleModal(){
  if(DATA.products.length === 0){ showToast("Add a product to inventory first", "ti-alert-circle"); return; }
  const defaultBranch = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
  openModal(`
    <div class="modal-title">Record a sale</div>
    <div class="field"><label>Branch</label><select id="f_branch">${branchSelectOptions(defaultBranch)}</select></div>
    <div class="field"><label>Product</label><select id="f_product">${productSelectOptions()}</select></div>
    <div class="field" id="stockHint" style="font-size:12px; color:var(--ink-soft); margin-top:-8px;"></div>
    <div class="field"><label>Quantity</label><input id="f_qty" type="number" min="1" value="1"></div>
    <div class="field"><label>Unit price (Rs)</label><input id="f_price" type="number" min="0" step="0.01"></div>
    <div class="field"><label>Customer name (optional)</label><input id="f_customer" placeholder="Walk-in"></div>
    <div id="saleError" style="display:none; background:var(--red-100); color:var(--red-700); font-size:12.5px; padding:9px 12px; border-radius:7px; margin-bottom:6px;"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveSaleBtn">Record sale</button>
    </div>
  `);

  const branchSel = document.getElementById("f_branch");
  const prodSel = document.getElementById("f_product");
  const priceInput = document.getElementById("f_price");
  const hint = document.getElementById("stockHint");

  function updateHint(){
    const prod = DATA.products.find(p=>p.id===prodSel.value);
    if(!prod) return;
    const stock = prod.stock[branchSel.value] || 0;
    hint.textContent = `${stock} unit${stock===1?'':'s'} in stock at this branch`;
    hint.style.color = stock === 0 ? "var(--red-500)" : "var(--ink-soft)";
    if(!priceInput.value) priceInput.value = prod.unitPrice;
  }
  branchSel.addEventListener("change", updateHint);
  prodSel.addEventListener("change", ()=>{ priceInput.value = ""; updateHint(); });
  updateHint();
  priceInput.value = (DATA.products.find(p=>p.id===prodSel.value)||{}).unitPrice || "";

  document.getElementById("saveSaleBtn").addEventListener("click", async ()=>{
    const branchId = branchSel.value;
    const productId = prodSel.value;
    const quantity = parseInt(document.getElementById("f_qty").value, 10);
    const unitPrice = parseFloat(priceInput.value) || 0;
    const customerName = document.getElementById("f_customer").value.trim() || "Walk-in";
    const errEl = document.getElementById("saleError");
    errEl.style.display = "none";

    if(!quantity || quantity <= 0){ errEl.textContent = "Enter a quantity greater than zero."; errEl.style.display="block"; return; }

    const btn = document.getElementById("saveSaleBtn");
    btn.disabled = true; btn.textContent = "Recording...";
    try{
      await dbRecordSale({ branchId, productId, quantity, unitPrice, customerName });
      await fetchAllData();
      closeModal();
      showToast("Sale recorded — stock updated");
      render();
    }catch(err){
      errEl.textContent = err.message || "Couldn't record this sale.";
      errEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Record sale";
    }
  });
}

// ===================== PURCHASES =====================
function renderPurchases(){
  const scopedPurchases = STATE.activeBranch === "all" ? DATA.purchases : DATA.purchases.filter(p=>p.branchId===STATE.activeBranch);
  const totalCost = scopedPurchases.reduce((s,x)=> s + x.quantity*x.unitCost, 0);

  const productName = (id) => (DATA.products.find(p=>p.id===id)||{}).name || "Unknown product";
  const branchName = (id) => (DATA.branches.find(b=>b.id===id)||{}).name?.replace("MediCore — ","") || "—";

  const rows = scopedPurchases.slice(0,50).map(p=>`
    <tr>
      <td class="mono">${fmtDateTime(p.createdAt)}</td>
      <td><div class="tname">${productName(p.productId)}</div></td>
      <td>${branchName(p.branchId)}</td>
      <td class="mono">${p.quantity}</td>
      <td class="mono">${fmtMoney(p.unitCost)}</td>
      <td class="mono" style="font-weight:500;">${fmtMoney(p.quantity*p.unitCost)}</td>
      <td>${p.supplier}</td>
    </tr>
  `).join("");

  return `
    <div class="metric-row" style="grid-template-columns:repeat(2,1fr);">
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-truck-delivery"></i> Total purchase cost</div>
        <div class="metric-value">${fmtMoney(totalCost)}</div>
        <div class="metric-delta up">${scopedPurchases.length} purchase${scopedPurchases.length===1?'':'s'} logged</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-building-store"></i> Scope</div>
        <div class="metric-value" style="font-size:16px;">${STATE.activeBranch==='all' ? 'All branches' : branchName(STATE.activeBranch)}</div>
        <div class="metric-delta up">Switch in sidebar</div>
      </div>
    </div>
    <div class="card" style="padding:0; overflow:hidden;">
      ${scopedPurchases.length === 0 ? `<div class="empty-state"><i class="ti ti-truck"></i>No purchases recorded yet — click "New purchase" to log stock coming in</div>` : `
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>Branch</th><th>Qty</th><th>Unit cost</th><th>Total</th><th>Supplier</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
  `;
}

function attachPurchasesHandlers(){
  const btn = document.getElementById("newPurchaseBtn");
  if(btn) btn.addEventListener("click", openNewPurchaseModal);
}

function openNewPurchaseModal(){
  if(DATA.products.length === 0){ showToast("Add a product to inventory first", "ti-alert-circle"); return; }
  const defaultBranch = STATE.activeBranch !== "all" ? STATE.activeBranch : DATA.branches[0].id;
  openModal(`
    <div class="modal-title">Record a purchase</div>
    <div class="field"><label>Branch receiving stock</label><select id="f_branch">${branchSelectOptions(defaultBranch)}</select></div>
    <div class="field"><label>Product</label><select id="f_product">${productSelectOptions()}</select></div>
    <div class="field"><label>Quantity received</label><input id="f_qty" type="number" min="1" value="1"></div>
    <div class="field"><label>Unit cost (Rs)</label><input id="f_cost" type="number" min="0" step="0.01"></div>
    <div class="field"><label>Supplier</label><input id="f_supplier" placeholder="e.g. Getz Pharma distributor"></div>
    <div id="purchaseError" style="display:none; background:var(--red-100); color:var(--red-700); font-size:12.5px; padding:9px 12px; border-radius:7px; margin-bottom:6px;"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="savePurchaseBtn">Record purchase</button>
    </div>
  `);

  document.getElementById("savePurchaseBtn").addEventListener("click", async ()=>{
    const branchId = document.getElementById("f_branch").value;
    const productId = document.getElementById("f_product").value;
    const quantity = parseInt(document.getElementById("f_qty").value, 10);
    const unitCost = parseFloat(document.getElementById("f_cost").value) || 0;
    const supplier = document.getElementById("f_supplier").value.trim() || "—";
    const errEl = document.getElementById("purchaseError");
    errEl.style.display = "none";

    if(!quantity || quantity <= 0){ errEl.textContent = "Enter a quantity greater than zero."; errEl.style.display="block"; return; }

    const btn = document.getElementById("savePurchaseBtn");
    btn.disabled = true; btn.textContent = "Recording...";
    try{
      await dbRecordPurchase({ branchId, productId, quantity, unitCost, supplier });
      await fetchAllData();
      closeModal();
      showToast("Purchase recorded — stock updated");
      render();
    }catch(err){
      errEl.textContent = err.message || "Couldn't record this purchase.";
      errEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Record purchase";
    }
  });
}

// ===================== STOCK TRANSFERS =====================
function renderTransfers(){
  const productName = (id) => (DATA.products.find(p=>p.id===id)||{}).name || "Unknown product";
  const branchName = (id) => (DATA.branches.find(b=>b.id===id)||{}).name?.replace("MediCore — ","") || "—";

  const rows = DATA.transfers.slice(0,50).map(t=>`
    <tr>
      <td class="mono">${fmtDateTime(t.createdAt)}</td>
      <td><div class="tname">${productName(t.productId)}</div></td>
      <td>${branchName(t.fromBranchId)}</td>
      <td><i class="ti ti-arrow-right" style="color:var(--ink-faint);"></i></td>
      <td>${branchName(t.toBranchId)}</td>
      <td class="mono">${t.quantity}</td>
      <td><span class="tag tag-ok">${t.status}</span></td>
    </tr>
  `).join("");

  return `
    <div class="card" style="padding:0; overflow:hidden;">
      ${DATA.transfers.length === 0 ? `<div class="empty-state"><i class="ti ti-arrows-exchange"></i>No stock transfers yet — click "New transfer" to move stock between branches</div>` : `
      <table>
        <thead><tr><th>Date</th><th>Product</th><th>From</th><th></th><th>To</th><th>Qty</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
  `;
}

function attachTransfersHandlers(){
  const btn = document.getElementById("newTransferBtn");
  if(btn) btn.addEventListener("click", openNewTransferModal);
}

function openNewTransferModal(){
  if(DATA.branches.length < 2){ showToast("You need at least 2 branches to transfer stock", "ti-alert-circle"); return; }
  if(DATA.products.length === 0){ showToast("Add a product to inventory first", "ti-alert-circle"); return; }

  openModal(`
    <div class="modal-title">Transfer stock between branches</div>
    <div class="field"><label>Product</label><select id="f_product">${productSelectOptions()}</select></div>
    <div class="field"><label>From branch</label><select id="f_from">${branchSelectOptions(DATA.branches[0].id)}</select></div>
    <div class="field"><label>To branch</label><select id="f_to">${branchSelectOptions(DATA.branches[1].id)}</select></div>
    <div class="field" id="transferStockHint" style="font-size:12px; color:var(--ink-soft); margin-top:-8px;"></div>
    <div class="field"><label>Quantity to transfer</label><input id="f_qty" type="number" min="1" value="1"></div>
    <div id="transferError" style="display:none; background:var(--red-100); color:var(--red-700); font-size:12.5px; padding:9px 12px; border-radius:7px; margin-bottom:6px;"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveTransferBtn">Transfer stock</button>
    </div>
  `);

  const prodSel = document.getElementById("f_product");
  const fromSel = document.getElementById("f_from");
  const hint = document.getElementById("transferStockHint");
  function updateHint(){
    const prod = DATA.products.find(p=>p.id===prodSel.value);
    const stock = prod ? (prod.stock[fromSel.value]||0) : 0;
    hint.textContent = `${stock} unit${stock===1?'':'s'} available at source branch`;
    hint.style.color = stock === 0 ? "var(--red-500)" : "var(--ink-soft)";
  }
  prodSel.addEventListener("change", updateHint);
  fromSel.addEventListener("change", updateHint);
  updateHint();

  document.getElementById("saveTransferBtn").addEventListener("click", async ()=>{
    const productId = prodSel.value;
    const fromBranchId = fromSel.value;
    const toBranchId = document.getElementById("f_to").value;
    const quantity = parseInt(document.getElementById("f_qty").value, 10);
    const errEl = document.getElementById("transferError");
    errEl.style.display = "none";

    if(fromBranchId === toBranchId){ errEl.textContent = "Source and destination must be different branches."; errEl.style.display="block"; return; }
    if(!quantity || quantity <= 0){ errEl.textContent = "Enter a quantity greater than zero."; errEl.style.display="block"; return; }

    const btn = document.getElementById("saveTransferBtn");
    btn.disabled = true; btn.textContent = "Transferring...";
    try{
      await dbRecordTransfer({ productId, fromBranchId, toBranchId, quantity });
      await fetchAllData();
      closeModal();
      showToast("Stock transferred");
      render();
    }catch(err){
      errEl.textContent = err.message || "Couldn't complete this transfer.";
      errEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Transfer stock";
    }
  });
}

// ===================== SUPPLIERS =====================
function renderSuppliers(){
  const rows = DATA.suppliers.map(s=>`
    <tr>
      <td><div class="tname">${s.name}</div></td>
      <td>${s.contactPerson}</td>
      <td class="mono">${s.phone}</td>
      <td>${s.email}</td>
    </tr>
  `).join("");

  return `
    <div class="card" style="padding:0; overflow:hidden;">
      ${DATA.suppliers.length === 0 ? `<div class="empty-state"><i class="ti ti-truck"></i>No suppliers added yet</div>` : `
      <table>
        <thead><tr><th>Supplier</th><th>Contact person</th><th>Phone</th><th>Email</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
  `;
}

function attachSuppliersHandlers(){
  const btn = document.getElementById("addSupplierBtn");
  if(btn) btn.addEventListener("click", openAddSupplierModal);
}

function openAddSupplierModal(){
  openModal(`
    <div class="modal-title">Add a supplier</div>
    <div class="field"><label>Supplier / company name</label><input id="f_name" placeholder="e.g. Getz Pharma Distribution"></div>
    <div class="field"><label>Contact person</label><input id="f_contact" placeholder="e.g. Faisal Mehmood"></div>
    <div class="field"><label>Phone</label><input id="f_phone" placeholder="+92 ..."></div>
    <div class="field"><label>Email</label><input id="f_email" type="email" placeholder="orders@supplier.pk"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveSupplierBtn">Add supplier</button>
    </div>
  `);
  document.getElementById("saveSupplierBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("f_name").value.trim();
    const contactPerson = document.getElementById("f_contact").value.trim();
    const phone = document.getElementById("f_phone").value.trim();
    const email = document.getElementById("f_email").value.trim();
    if(!name){ showToast("Please enter a supplier name", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveSupplierBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbAddSupplier({ name, contactPerson: contactPerson || "—", phone: phone || "—", email: email || "—" });
      await fetchAllData();
      closeModal();
      showToast("Supplier added");
      render();
    }catch(err){
      showToast(err.message || "Couldn't add supplier", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Add supplier";
    }
  });
}

// ===================== PROFIT & EXPENSES =====================

// One-off expenses for a branch within the current month, plus any active
// recurring expenses for that branch (rent, electricity, etc.), which are
// counted once per month regardless of when in the month they were set up.
function monthlyExpensesForBranch(branchId, monthDate){
  const isSameMonth = (iso) => { const d = new Date(iso); return d.getMonth()===monthDate.getMonth() && d.getFullYear()===monthDate.getFullYear(); };
  const oneOff = DATA.expenses.filter(e => e.branchId === branchId && isSameMonth(e.expenseDate)).reduce((s,e)=>s+e.amount,0);
  const recurring = DATA.recurringExpenses.filter(r => r.branchId === branchId && r.active).reduce((s,r)=>s+r.amount,0);
  return { oneOff, recurring, total: oneOff + recurring };
}

function branchRevenueForMonth(branchId, monthDate){
  const isSameMonth = (iso) => { const d = new Date(iso); return d.getMonth()===monthDate.getMonth() && d.getFullYear()===monthDate.getFullYear(); };
  return DATA.sales.filter(s=>s.branchId===branchId && isSameMonth(s.createdAt)).reduce((s,x)=>s+x.quantity*x.unitPrice,0);
}

function renderProfit(){
  const now = new Date("2026-06-21");
  const branches = DATA.branches;

  const rows = branches.map(b=>{
    const revenue = branchRevenueForMonth(b.id, now);
    const exp = monthlyExpensesForBranch(b.id, now);
    const profit = revenue - exp.total;
    return { branch: b, revenue, exp, profit };
  });

  const totalRevenue = rows.reduce((s,r)=>s+r.revenue,0);
  const totalExpenses = rows.reduce((s,r)=>s+r.exp.total,0);
  const totalProfit = totalRevenue - totalExpenses;
  const maxAbsProfit = Math.max(1, ...rows.map(r=>Math.abs(r.profit)));

  const recentExpenseRows = DATA.expenses.slice(0,30).map(e=>{
    const b = DATA.branches.find(x=>x.id===e.branchId);
    return `
      <tr>
        <td class="mono">${e.expenseDate}</td>
        <td>${b ? b.name.replace("MediCore — ","") : "—"}</td>
        <td><span class="tag tag-low">${e.category}</span></td>
        <td>${e.description || "—"}</td>
        <td class="mono" style="text-align:right;">${fmtMoney(e.amount)}</td>
      </tr>
    `;
  }).join("");

  const recurringRows = branches.map(b=>{
    const recs = DATA.recurringExpenses.filter(r=>r.branchId===b.id);
    if(recs.length === 0) return "";
    return recs.map(r=>`
      <tr>
        <td>${b.name.replace("MediCore — ","")}</td>
        <td><span class="tag tag-ok">${r.category}</span></td>
        <td class="mono" style="text-align:right;">${fmtMoney(r.amount)}/mo</td>
        <td style="text-align:right;"><button class="btn btn-sm" data-remove-recurring="${r.id}"><i class="ti ti-x"></i></button></td>
      </tr>
    `).join("");
  }).join("");

  return `
    <div class="metric-row" style="grid-template-columns:repeat(3,1fr);">
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-trending-up"></i> Revenue this month</div>
        <div class="metric-value">${fmtMoney(totalRevenue)}</div>
        <div class="metric-delta up">Across all branches</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-trending-down"></i> Expenses this month</div>
        <div class="metric-value" style="color:var(--amber-600);">${fmtMoney(totalExpenses)}</div>
        <div class="metric-delta down">Rent, bills, petty cash &amp; more</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-chart-pie"></i> Net profit this month</div>
        <div class="metric-value" style="color:${totalProfit>=0?'var(--teal-700)':'var(--red-500)'};">${fmtMoney(totalProfit)}</div>
        <div class="metric-delta ${totalProfit>=0?'up':'down'}">Revenue minus all expenses</div>
      </div>
    </div>

    <div class="section-head"><div class="section-title">Profit by branch — this month</div></div>
    <div class="card" style="margin-bottom:var(--sp-6);">
      ${rows.map(r=>`
        <div style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
            <div>
              <span style="font-weight:600; font-size:13.5px;">${r.branch.name.replace("MediCore — ","")}</span>
              <span style="font-size:12px; color:var(--ink-soft); margin-left:8px;">Revenue ${fmtMoney(r.revenue)} &middot; Expenses ${fmtMoney(r.exp.total)}</span>
            </div>
            <span class="mono" style="font-weight:700; font-size:14px; color:${r.profit>=0?'var(--teal-700)':'var(--red-500)'};">${fmtMoney(r.profit)}</span>
          </div>
          <div style="height:10px; background:var(--paper-dim); border-radius:5px; overflow:hidden; position:relative;">
            <div style="height:100%; width:${Math.min(100, Math.abs(r.profit)/maxAbsProfit*100).toFixed(1)}%; background:${r.profit>=0?'var(--teal-600)':'var(--red-500)'}; border-radius:5px;"></div>
          </div>
        </div>
      `).join("")}
    </div>

    <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:var(--sp-5);">
      <div>
        <div class="section-head"><div class="section-title">Recent expenses</div></div>
        <div class="card" style="padding:0; overflow:hidden;">
          ${DATA.expenses.length === 0 ? `<div class="empty-state"><i class="ti ti-receipt"></i>No expenses logged yet</div>` : `
          <table>
            <thead><tr><th>Date</th><th>Branch</th><th>Category</th><th>Note</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>${recentExpenseRows}</tbody>
          </table>`}
        </div>
      </div>
      <div>
        <div class="section-head">
          <div class="section-title">Recurring monthly costs</div>
          <div class="section-link" id="addRecurringLink">+ Add recurring</div>
        </div>
        <div class="card" style="padding:0; overflow:hidden;">
          ${DATA.recurringExpenses.length === 0 ? `<div class="empty-state"><i class="ti ti-calendar-stats"></i>No recurring costs set up yet</div>` : `
          <table>
            <thead><tr><th>Branch</th><th>Category</th><th style="text-align:right;">Amount</th><th></th></tr></thead>
            <tbody>${recurringRows}</tbody>
          </table>`}
        </div>
      </div>
    </div>
  `;
}

function attachProfitHandlers(){
  const btn = document.getElementById("addExpenseBtn");
  if(btn) btn.addEventListener("click", openAddExpenseModal);
  const recLink = document.getElementById("addRecurringLink");
  if(recLink) recLink.addEventListener("click", openAddRecurringModal);
  document.querySelectorAll("[data-remove-recurring]").forEach(el=>{
    el.addEventListener("click", async ()=>{
      try{
        await dbDeleteRecurringExpense(el.dataset.removeRecurring);
        await fetchAllData();
        showToast("Recurring cost removed");
        render();
      }catch(err){
        showToast(err.message || "Couldn't remove this", "ti-alert-circle");
      }
    });
  });
}

const EXPENSE_CATEGORIES = ["Rent","Electricity","Water","Petty Cash","Maintenance","Salaries","Internet/Phone","Transport","Other"];

function openAddExpenseModal(){
  if(DATA.branches.length === 0){ showToast("Add a branch first", "ti-alert-circle"); return; }
  openModal(`
    <div class="modal-title">Add an expense</div>
    <div class="field"><label>Branch</label><select id="f_branch">${branchSelectOptions(STATE.activeBranch!=='all'?STATE.activeBranch:DATA.branches[0].id)}</select></div>
    <div class="field"><label>Category</label><select id="f_category">${EXPENSE_CATEGORIES.map(c=>`<option>${c}</option>`).join("")}</select></div>
    <div class="field"><label>Amount (Rs)</label><input id="f_amount" type="number" min="0" step="0.01" placeholder="e.g. 45000"></div>
    <div class="field"><label>Date</label><input id="f_date" type="date" value="2026-06-21"></div>
    <div class="field"><label>Note (optional)</label><input id="f_desc" placeholder="e.g. AC repair"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveExpenseBtn">Add expense</button>
    </div>
  `);
  document.getElementById("saveExpenseBtn").addEventListener("click", async ()=>{
    const branchId = document.getElementById("f_branch").value;
    const category = document.getElementById("f_category").value;
    const amount = parseFloat(document.getElementById("f_amount").value) || 0;
    const expenseDate = document.getElementById("f_date").value || "2026-06-21";
    const description = document.getElementById("f_desc").value.trim();
    if(amount <= 0){ showToast("Enter an amount greater than zero", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveExpenseBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbAddExpense({ branchId, category, description, amount, expenseDate });
      await fetchAllData();
      closeModal();
      showToast("Expense added");
      render();
    }catch(err){
      showToast(err.message || "Couldn't add expense", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Add expense";
    }
  });
}

function openAddRecurringModal(){
  if(DATA.branches.length === 0){ showToast("Add a branch first", "ti-alert-circle"); return; }
  openModal(`
    <div class="modal-title">Add a recurring monthly cost</div>
    <div class="field"><label>Branch</label><select id="f_branch">${branchSelectOptions(STATE.activeBranch!=='all'?STATE.activeBranch:DATA.branches[0].id)}</select></div>
    <div class="field"><label>Category</label><select id="f_category">${EXPENSE_CATEGORIES.slice(0,7).map(c=>`<option>${c}</option>`).join("")}</select></div>
    <div class="field"><label>Amount per month (Rs)</label><input id="f_amount" type="number" min="0" step="0.01" placeholder="e.g. 80000"></div>
    <div style="font-size:12px; color:var(--ink-soft); margin-top:-8px; margin-bottom:14px;">This will be counted automatically every month — you won't need to re-enter it.</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveRecurringBtn">Add recurring cost</button>
    </div>
  `);
  document.getElementById("saveRecurringBtn").addEventListener("click", async ()=>{
    const branchId = document.getElementById("f_branch").value;
    const category = document.getElementById("f_category").value;
    const amount = parseFloat(document.getElementById("f_amount").value) || 0;
    if(amount <= 0){ showToast("Enter an amount greater than zero", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveRecurringBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbSetRecurringExpense({ branchId, category, amount, active: true });
      await fetchAllData();
      closeModal();
      showToast("Recurring cost added");
      render();
    }catch(err){
      showToast(err.message || "Couldn't add this", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Add recurring cost";
    }
  });
}

// ===================== ATTENDANCE =====================

function activeAttendanceFor(employeeId){
  return DATA.attendance.find(a => a.employeeId === employeeId && !a.checkOut && a.status === "present");
}

function renderAttendance(){
  const emps = STATE.activeBranch === "all" ? DATA.employees : DATA.employees.filter(e=>e.branch===STATE.activeBranch);
  const branchName = (id) => (DATA.branches.find(b=>b.id===id)||{}).name?.replace("MediCore — ","") || "—";

  const today = new Date("2026-06-21").toDateString();
  const todaysRecords = DATA.attendance.filter(a => new Date(a.checkIn).toDateString() === today);

  const statusRows = emps.map(e=>{
    const open = activeAttendanceFor(e.id);
    const todays = todaysRecords.filter(a=>a.employeeId===e.id);
    const lastToday = todays[0];
    let statusTag, timeInfo;
    if(open){
      statusTag = `<span class="tag tag-ok">Checked in</span>`;
      timeInfo = `Since ${new Date(open.checkIn).toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'})}`;
    }else if(lastToday && lastToday.status === "absent"){
      statusTag = `<span class="tag tag-out">Absent today</span>`;
      timeInfo = "—";
    }else if(lastToday && lastToday.status === "leave"){
      statusTag = `<span class="tag tag-low">On leave</span>`;
      timeInfo = "—";
    }else if(lastToday && lastToday.checkOut){
      statusTag = `<span class="tag tag-low">Checked out</span>`;
      timeInfo = `${new Date(lastToday.checkIn).toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'})} – ${new Date(lastToday.checkOut).toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'})}`;
    }else{
      statusTag = `<span class="tag" style="background:var(--paper-dim); color:var(--ink-soft);">Not marked</span>`;
      timeInfo = "—";
    }
    return `
      <tr>
        <td><div class="person-cell"><div class="avatar">${initials(e.name)}</div><div><div class="tname">${e.name}</div><div class="tsub">${e.role}</div></div></div></td>
        <td>${branchName(e.branch)}</td>
        <td>${statusTag}</td>
        <td class="mono">${timeInfo}</td>
        <td style="text-align:right;">
          <button class="btn btn-sm" data-attendance-history="${e.id}">History</button>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="card" style="padding:0; overflow:hidden;">
      ${emps.length === 0 ? `<div class="empty-state"><i class="ti ti-clock-check"></i>No employees to track yet</div>` : `
      <table>
        <thead><tr><th>Employee</th><th>Branch</th><th>Today's status</th><th>Time</th><th></th></tr></thead>
        <tbody>${statusRows}</tbody>
      </table>`}
    </div>
  `;
}

function attachAttendanceHandlers(){
  const btn = document.getElementById("checkInOutBtn");
  if(btn) btn.addEventListener("click", openCheckInOutModal);
  document.querySelectorAll("[data-attendance-history]").forEach(el=>{
    el.addEventListener("click", ()=> openAttendanceHistoryModal(el.dataset.attendanceHistory));
  });
}

function openCheckInOutModal(){
  const emps = STATE.activeBranch === "all" ? DATA.employees : DATA.employees.filter(e=>e.branch===STATE.activeBranch);
  if(emps.length === 0){ showToast("Add an employee first", "ti-alert-circle"); return; }

  openModal(`
    <div class="modal-title">Who are you?</div>
    <div style="font-size:12.5px; color:var(--ink-soft); margin-bottom:16px;">Select your name to check in or out.</div>
    <div style="display:flex; flex-direction:column; gap:6px; max-height:320px; overflow-y:auto;">
      ${emps.map(e=>{
        const open = activeAttendanceFor(e.id);
        return `
          <div style="display:flex; align-items:center; justify-content:between; gap:10px; padding:10px 12px; border:1px solid var(--line); border-radius:var(--radius-sm); cursor:pointer;" data-pick-employee="${e.id}">
            <div class="avatar">${initials(e.name)}</div>
            <div style="flex:1;">
              <div class="tname">${e.name}</div>
              <div class="tsub">${e.role}</div>
            </div>
            <span class="tag ${open?'tag-ok':'tag-low'}">${open?'Checked in':'Checked out'}</span>
          </div>
        `;
      }).join("")}
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button></div>
  `);

  document.querySelectorAll("[data-pick-employee]").forEach(el=>{
    el.addEventListener("click", async ()=>{
      const employeeId = el.dataset.pickEmployee;
      const emp = DATA.employees.find(e=>e.id===employeeId);
      const open = activeAttendanceFor(employeeId);
      try{
        if(open){
          await dbCheckOut({ employeeId });
          showToast(`${emp.name} checked out`);
        }else{
          await dbCheckIn({ employeeId, branchId: emp.branch });
          showToast(`${emp.name} checked in`);
        }
        await fetchAllData();
        closeModal();
        render();
      }catch(err){
        showToast(err.message || "Couldn't update attendance", "ti-alert-circle");
      }
    });
  });
}

function openAttendanceHistoryModal(employeeId){
  const emp = DATA.employees.find(e=>e.id===employeeId);
  const records = DATA.attendance.filter(a=>a.employeeId===employeeId).slice(0,20);
  const rows = records.map(a=>{
    const date = new Date(a.checkIn).toLocaleDateString("en-GB",{day:'2-digit',month:'short'});
    const inTime = new Date(a.checkIn).toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'});
    const outTime = a.checkOut ? new Date(a.checkOut).toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'}) : "—";
    const statusLabel = a.status === "present" ? "Present" : a.status === "absent" ? "Absent" : "Leave";
    return `<tr><td class="mono">${date}</td><td>${statusLabel}</td><td class="mono">${a.status==='present'?inTime:'—'}</td><td class="mono">${a.status==='present'?outTime:'—'}</td></tr>`;
  }).join("");

  openModal(`
    <div class="modal-title">${emp.name} — attendance history</div>
    <div class="card" style="padding:0; overflow:hidden; max-height:340px; overflow-y:auto; margin-bottom:16px;">
      ${records.length === 0 ? `<div class="empty-state"><i class="ti ti-clock-check"></i>No attendance records yet</div>` : `
      <table>
        <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
    <div class="field"><label>Mark absence or leave for today</label>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm" data-mark-absence="${employeeId}" data-status="absent">Mark absent</button>
        <button class="btn btn-sm" data-mark-absence="${employeeId}" data-status="leave">Mark on leave</button>
      </div>
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>
  `);

  document.querySelectorAll("[data-mark-absence]").forEach(el=>{
    el.addEventListener("click", async ()=>{
      try{
        await dbRecordAbsence({ employeeId, branchId: emp.branch, status: el.dataset.status, date: "2026-06-21" });
        await fetchAllData();
        closeModal();
        showToast(`${emp.name} marked as ${el.dataset.status}`);
        render();
      }catch(err){
        showToast(err.message || "Couldn't save this", "ti-alert-circle");
      }
    });
  });
}

// ===================== EMPLOYEES =====================
function renderEmployees(){
  let emps = DATA.employees.slice();
  if(STATE.activeBranch !== "all") emps = emps.filter(e=>e.branch===STATE.activeBranch);
  if(STATE.empSearch.trim()){
    const q = STATE.empSearch.trim().toLowerCase();
    emps = emps.filter(e => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q));
  }

  const branchName = (id) => (DATA.branches.find(b=>b.id===id)||{}).name?.replace("MediCore — ","") || "—";

  const rows = emps.map(e=>`
    <tr>
      <td>
        <div class="person-cell">
          <div class="avatar">${initials(e.name)}</div>
          <div>
            <div class="tname">${e.name}</div>
            <div class="tsub">${e.role}</div>
          </div>
        </div>
      </td>
      <td>${branchName(e.branch)}</td>
      <td class="mono">${e.phone}</td>
      <td>${e.shift}</td>
      <td class="mono">${e.joined}</td>
      <td><span class="tag ${e.status==='Active'?'tag-ok':'tag-low'}">${e.status}</span></td>
      <td style="text-align:right;"><button class="btn btn-sm" data-edit-emp="${e.id}"><i class="ti ti-edit"></i></button></td>
    </tr>
  `).join("");

  return `
    <div class="toolbar">
      <input class="search-input" id="empSearchInput" placeholder="Search by name or role..." value="${STATE.empSearch}">
    </div>
    <div class="card" style="padding:0; overflow:hidden;">
      ${emps.length === 0 ? `<div class="empty-state"><i class="ti ti-users"></i>No employees match</div>` : `
      <table>
        <thead><tr><th>Employee</th><th>Branch</th><th>Phone</th><th>Shift</th><th>Joined</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
  `;
}

function attachEmployeeHandlers(){
  const search = document.getElementById("empSearchInput");
  if(search){
    search.addEventListener("input", (e)=>{ STATE.empSearch = e.target.value; renderInPlace(); });
    setTimeout(()=> search.focus(), 0);
  }
  const addBtn = document.getElementById("addEmployeeBtn");
  if(addBtn) addBtn.addEventListener("click", openAddEmployeeModal);
  document.querySelectorAll("[data-edit-emp]").forEach(el=>{
    el.addEventListener("click", ()=> openEditEmployeeModal(el.dataset.editEmp));
  });
}

function branchSelectOptions(selectedId){
  return DATA.branches.map(b=>`<option value="${b.id}" ${b.id===selectedId?'selected':''}>${b.name}</option>`).join("");
}

function openAddEmployeeModal(){
  openModal(`
    <div class="modal-title">Add an employee</div>
    <div class="field"><label>Full name</label><input id="f_name" placeholder="e.g. Ali Hamza"></div>
    <div class="field"><label>Role</label><input id="f_role" placeholder="e.g. Pharmacist"></div>
    <div class="field"><label>Branch</label><select id="f_branch">${branchSelectOptions(STATE.activeBranch!=='all'?STATE.activeBranch:DATA.branches[0].id)}</select></div>
    <div class="field"><label>Phone</label><input id="f_phone" placeholder="+92 ..."></div>
    <div class="field"><label>Shift</label><select id="f_shift"><option>Morning</option><option>Evening</option><option>Night</option></select></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEmpBtn">Add employee</button>
    </div>
  `);
  document.getElementById("saveEmpBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("f_name").value.trim();
    const role = document.getElementById("f_role").value.trim();
    const branch = document.getElementById("f_branch").value;
    const phone = document.getElementById("f_phone").value.trim();
    const shift = document.getElementById("f_shift").value;
    if(!name || !role){ showToast("Please fill in name and role", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveEmpBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbAddEmployee({ name, role, branch, phone: phone || "—", shift });
      await fetchAllData();
      closeModal();
      showToast("Employee added");
      render();
    }catch(err){
      showToast(err.message || "Couldn't add employee", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Add employee";
    }
  });
}

function openEditEmployeeModal(empId){
  const e = DATA.employees.find(x=>x.id===empId);
  openModal(`
    <div class="modal-title">Edit employee</div>
    <div class="field"><label>Full name</label><input id="f_name" value="${e.name}"></div>
    <div class="field"><label>Role</label><input id="f_role" value="${e.role}"></div>
    <div class="field"><label>Branch</label><select id="f_branch">${branchSelectOptions(e.branch)}</select></div>
    <div class="field"><label>Phone</label><input id="f_phone" value="${e.phone}"></div>
    <div class="field"><label>Shift</label>
      <select id="f_shift">
        ${["Morning","Evening","Night"].map(s=>`<option ${e.shift===s?'selected':''}>${s}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Status</label>
      <select id="f_status">
        ${["Active","On leave","Inactive"].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEmpBtn">Save changes</button>
    </div>
  `);
  document.getElementById("saveEmpBtn").addEventListener("click", async ()=>{
    const fields = {
      name: document.getElementById("f_name").value.trim() || e.name,
      role: document.getElementById("f_role").value.trim() || e.role,
      branch: document.getElementById("f_branch").value,
      phone: document.getElementById("f_phone").value.trim() || e.phone,
      shift: document.getElementById("f_shift").value,
      status: document.getElementById("f_status").value,
    };
    const btn = document.getElementById("saveEmpBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbUpdateEmployee(empId, fields);
      await fetchAllData();
      closeModal();
      showToast("Employee updated");
      render();
    }catch(err){
      showToast(err.message || "Couldn't update employee", "ti-alert-circle");
      btn.disabled = false; btn.textContent = "Save changes";
    }
  });
}

// ===================== AI ASSISTANT =====================
const AI_SUGGESTIONS = [
  "Which branch is low on Augmentin?",
  "What's our profit this month?",
  "Who's checked in today?",
  "What are our top selling products?",
  "Show items expiring in the next 60 days",
  "What are our expenses this month?"
];

// Chat history lives only for the current session (not saved to the database) —
// it's a conversation log, not pharmacy data, so it resets on sign-out/refresh.
let AI_CHAT_HISTORY = [];

function renderAssistant(){
  const history = AI_CHAT_HISTORY;
  return `
    <div class="ai-shell">
      <div class="ai-msgs" id="aiMsgs">
        ${history.length === 0 ? `
          <div class="ai-msg assistant">
            <div class="ai-icon"><i class="ti ti-sparkles"></i></div>
            <div class="ai-bubble">
              I can answer questions about your stock, staff, and branches — across all locations or just one. Try asking something below, or type your own question.
              <div class="ai-suggestions">
                ${AI_SUGGESTIONS.map(s=>`<div class="ai-chip" data-ask="${s.replace(/"/g,'&quot;')}">${s}</div>`).join("")}
              </div>
            </div>
          </div>
        ` : history.map(m=>`
          <div class="ai-msg ${m.role}">
            ${m.role==='assistant' ? `<div class="ai-icon"><i class="ti ti-sparkles"></i></div>` : ''}
            <div class="ai-bubble">${m.html}</div>
          </div>
        `).join("")}
      </div>
      <div class="ai-inputbar">
        <input class="ai-input" id="aiInput" placeholder="Ask about stock, staff, or branches...">
        <button class="btn btn-primary" id="aiSendBtn"><i class="ti ti-arrow-right"></i></button>
      </div>
    </div>
  `;
}

function attachAssistantHandlers(){
  const input = document.getElementById("aiInput");
  const sendBtn = document.getElementById("aiSendBtn");
  const scrollToBottom = ()=>{ const m = document.getElementById("aiMsgs"); if(m) m.scrollTop = m.scrollHeight; };
  scrollToBottom();
  input.focus();

  function send(text){
    if(!text || !text.trim()) return;
    AI_CHAT_HISTORY.push({ role:"user", html: escapeHtml(text) });
    const answer = answerQuery(text);
    AI_CHAT_HISTORY.push({ role:"assistant", html: answer });
    document.getElementById("contentArea").innerHTML = renderPage();
    attachAssistantHandlers();
  }

  sendBtn.addEventListener("click", ()=>{ send(input.value); input.value=""; });
  input.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ send(input.value); input.value=""; }});
  document.querySelectorAll("[data-ask]").forEach(el=>{
    el.addEventListener("click", ()=> send(el.dataset.ask));
  });
}

function escapeHtml(s){
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Rule-based query engine over real app data — no external API needed.
// Improves on simple substring checks: strips punctuation, ignores common
// filler words, and lets a query match if it shares enough significant words
// with an intent's synonym set — so phrasing variations succeed, not just
// exact keyword hits.
const STOP_WORDS = new Set(["the","a","an","is","are","was","were","do","does","did","of","for","to","in","on","at","with","and","or","my","our","i","we","you","please","tell","show","me","what","whats","which","who","how","can","could","would","there","any","right","now","today"]);

function tokenize(text){
  return text.toLowerCase().replace(/[?.,!]/g,"").split(/\s+/).filter(w=>w && !STOP_WORDS.has(w));
}

function matchesIntent(tokens, synonymGroups){
  // synonymGroups is an array of arrays — query must contain at least one
  // word from EACH group to count as a match (so "low stock branch" needs
  // a stock-word AND doesn't need a branch-word if branch group is optional).
  return synonymGroups.every(group => group.some(syn => tokens.some(t => t.includes(syn) || syn.includes(t))));
}

function anyWord(tokens, words){
  return words.some(w => tokens.some(t => t.includes(w) || w.includes(t)));
}

function answerQuery(raw){
  const q = raw.toLowerCase().replace(/[?.,!]/g,"");
  const tokens = tokenize(raw);

  // Fuzzy product lookup: matches against ANY significant word in the
  // product name (not just the first), so "625mg", "augmentin", or
  // "antibiotic for infection" style phrasing all have a chance to hit.
  const findProduct = () => {
    let best = null, bestScore = 0;
    DATA.products.forEach(p=>{
      const nameWords = p.name.toLowerCase().replace(/[^\w\s]/g,"").split(/\s+/);
      let score = 0;
      nameWords.forEach(nw=>{
        if(nw.length < 3) return;
        if(q.includes(nw)) score += nw.length; // longer matches count more
      });
      if(score > bestScore){ bestScore = score; best = p; }
    });
    return bestScore > 0 ? best : null;
  };

  const findBranch = () => {
    return DATA.branches.find(b=>{
      const city = b.city.toLowerCase();
      const shortName = b.name.toLowerCase().split("—")[1]?.trim() || "";
      return q.includes(city) || (shortName && q.includes(shortName.split(" ")[0]));
    });
  };

  // ---------- out of stock ----------
  if(matchesIntent(tokens, [["out","zero","empty","finished","ran"]]) && anyWord(tokens,["stock","supply"])){
    const out = [];
    DATA.products.forEach(p=>{
      DATA.branches.forEach(b=>{
        if((p.stock[b.id]||0) === 0) out.push({p,b});
      });
    });
    if(out.length===0) return "Nothing is currently out of stock across any branch. <i class='ti ti-circle-check'></i>";
    const rows = out.map(o=>`<tr><td>${o.p.name}</td><td>${o.b.name.replace("MediCore — ","")}</td></tr>`).join("");
    return `${out.length} item${out.length>1?'s are':' is'} out of stock right now:` + miniTable(["Product","Branch"], rows);
  }

  // ---------- low stock / restock / reorder ----------
  if(anyWord(tokens,["low","short","running","restock","reorder","need","short-on","shortage"])){
    const prod = findProduct();
    if(prod){
      const rows = DATA.branches.map(b=>{
        const qty = prod.stock[b.id]||0;
        const status = stockStatus(qty, prod.reorderLevel);
        return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${qty}</td><td>${status==='ok'?'Healthy':status==='low'?'Low':'Out'}</td></tr>`;
      }).join("");
      const lowBranches = DATA.branches.filter(b => stockStatus(prod.stock[b.id]||0, prod.reorderLevel) !== "ok");
      const summary = lowBranches.length
        ? `<b>${lowBranches.map(b=>b.name.replace("MediCore — ","")).join(" and ")}</b> need${lowBranches.length===1?'s':''} ${prod.name} restocked (reorder level is ${prod.reorderLevel}).`
        : `All branches currently have healthy stock of ${prod.name}.`;
      return summary + miniTable(["Branch","Stock","Status"], rows);
    }
    const lowItems = DATA.products.map(p=>({...p, qty: stockForBranch(p, STATE.activeBranch)})).filter(p=>stockStatus(p.qty,p.reorderLevel)!=="ok");
    if(lowItems.length===0) return "Everything is above its reorder level right now — no restocking needed.";
    const rows = lowItems.map(p=>`<tr><td>${p.name}</td><td class="mono">${p.qty}</td><td>${p.qty===0?'Out':'Low'}</td></tr>`).join("");
    return `${lowItems.length} product${lowItems.length>1?'s':''} need attention${STATE.activeBranch!=='all'?' at this branch':' across branches'}:` + miniTable(["Product","Stock","Status"], rows);
  }

  // ---------- expiring ----------
  if(anyWord(tokens,["expir","expire","expiring","expired"]) || q.includes("expir")){
    const days = q.match(/(\d+)\s*day/);
    const limit = days ? parseInt(days[1],10) : 120;
    const items = DATA.products.map(p=>({...p, d: daysUntil(p.expiry)})).filter(p=>p.d <= limit).sort((a,b)=>a.d-b.d);
    if(items.length===0) return `Nothing is expiring within ${limit} days. Your stock is in good shape.`;
    const rows = items.map(p=>`<tr><td>${p.name}</td><td class="mono">${p.batch}</td><td class="mono">${p.d} days</td></tr>`).join("");
    return `${items.length} product${items.length>1?'s':''} expiring within ${limit} days:` + miniTable(["Product","Batch","Time left"], rows);
  }

  // ---------- profit / expenses ----------
  if(anyWord(tokens,["profit","margin","earning","earnings","net"]) && !anyWord(tokens,["staff","employee"])){
    const now = new Date("2026-06-21");
    const rows = DATA.branches.map(b=>{
      const revenue = branchRevenueForMonth(b.id, now);
      const exp = monthlyExpensesForBranch(b.id, now);
      const profit = revenue - exp.total;
      return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${fmtMoney(revenue)}</td><td class="mono">${fmtMoney(exp.total)}</td><td class="mono" style="font-weight:600; color:${profit>=0?'inherit':'#E11D48'}">${fmtMoney(profit)}</td></tr>`;
    }).join("");
    const totalProfit = DATA.branches.reduce((s,b)=>{
      const now2 = new Date("2026-06-21");
      return s + branchRevenueForMonth(b.id, now2) - monthlyExpensesForBranch(b.id, now2).total;
    },0);
    return `This month's net profit across all branches is <b>${fmtMoney(totalProfit)}</b> (revenue minus rent, bills, and other expenses).` + miniTable(["Branch","Revenue","Expenses","Profit"], rows);
  }

  if(anyWord(tokens,["expense","expenses","cost","costs","spending","spent","rent","electricity","bill","bills"])){
    const now = new Date("2026-06-21");
    const rows = DATA.branches.map(b=>{
      const exp = monthlyExpensesForBranch(b.id, now);
      return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${fmtMoney(exp.recurring)}</td><td class="mono">${fmtMoney(exp.oneOff)}</td><td class="mono" style="font-weight:600;">${fmtMoney(exp.total)}</td></tr>`;
    }).join("");
    return `Expenses this month by branch (recurring costs like rent/electricity, plus one-off costs like petty cash):` + miniTable(["Branch","Recurring","One-off","Total"], rows);
  }

  // ---------- attendance ----------
  if(anyWord(tokens,["attendance","checked","absent","leave","late","present"]) || (anyWord(tokens,["who"]) && anyWord(tokens,["work","working","came","in"]))){
    const today = new Date("2026-06-21").toDateString();
    const todays = DATA.attendance.filter(a=>new Date(a.checkIn).toDateString()===today);
    const empName = (id)=> (DATA.employees.find(e=>e.id===id)||{}).name || "Unknown";
    if(anyWord(tokens,["absent"])){
      const absent = todays.filter(a=>a.status==="absent");
      if(absent.length===0) return "No one has been marked absent today.";
      const rows = absent.map(a=>`<tr><td>${empName(a.employeeId)}</td></tr>`).join("");
      return `${absent.length} employee${absent.length>1?'s':''} marked absent today:` + miniTable(["Employee"], rows);
    }
    const checkedIn = todays.filter(a=>a.status==="present" && !a.checkOut);
    if(checkedIn.length===0) return "No one is currently checked in.";
    const rows = checkedIn.map(a=>`<tr><td>${empName(a.employeeId)}</td><td class="mono">${new Date(a.checkIn).toLocaleTimeString("en-GB",{hour:'2-digit',minute:'2-digit'})}</td></tr>`).join("");
    return `${checkedIn.length} employee${checkedIn.length>1?'s are':' is'} currently checked in:` + miniTable(["Employee","Since"], rows);
  }

  // ---------- inventory value ----------
  if(anyWord(tokens,["value","worth","valuation"])){
    const total = DATA.products.reduce((s,p)=> s + totalStock(p)*p.unitPrice, 0);
    const rows = DATA.branches.map(b=>{
      const v = DATA.products.reduce((s,p)=> s + (p.stock[b.id]||0)*p.unitPrice, 0);
      return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${fmtMoney(v)}</td></tr>`;
    }).join("");
    return `Total inventory value across all branches is <b>${fmtMoney(total)}</b>.` + miniTable(["Branch","Value"], rows);
  }

  // ---------- revenue / sales / best sellers ----------
  if(anyWord(tokens,["revenue","sales","sold","selling","seller","sellers","bestseller","income"])){
    if(DATA.sales.length === 0) return "No sales have been recorded yet. Use the Sales page or Point of Sale to log your first one.";
    const productName = (id) => (DATA.products.find(p=>p.id===id)||{}).name || "Unknown";
    const totals = {};
    DATA.sales.forEach(s=>{
      totals[s.productId] = (totals[s.productId]||0) + s.quantity;
    });
    const ranked = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const totalRevenue = DATA.sales.reduce((s,x)=> s + x.quantity*x.unitPrice, 0);
    const rows = ranked.map(([pid,qty])=>`<tr><td>${productName(pid)}</td><td class="mono">${qty} sold</td></tr>`).join("");
    return `Total revenue logged so far is <b>${fmtMoney(totalRevenue)}</b> across ${DATA.sales.length} sales. Top sellers by quantity:` + miniTable(["Product","Units sold"], rows);
  }

  // ---------- purchases / suppliers ----------
  if(anyWord(tokens,["purchase","purchases","supplier","suppliers","received","ordered","vendor","vendors"])){
    if(DATA.purchases.length === 0) return "No purchases have been recorded yet. Use the Purchases page to log stock coming in from suppliers.";
    const totalCost = DATA.purchases.reduce((s,x)=> s + x.quantity*x.unitCost, 0);
    const productName = (id) => (DATA.products.find(p=>p.id===id)||{}).name || "Unknown";
    const recent = DATA.purchases.slice(0,5).map(p=>`<tr><td>${productName(p.productId)}</td><td class="mono">${p.quantity}</td><td>${p.supplier}</td></tr>`).join("");
    return `Total spent on purchases is <b>${fmtMoney(totalCost)}</b> across ${DATA.purchases.length} orders. Most recent:` + miniTable(["Product","Qty","Supplier"], recent);
  }

  // ---------- staff comparison ----------
  if(anyWord(tokens,["staff","employee","employees","headcount","workers"]) && anyWord(tokens,["compare","across","many","count","total","number"])){
    const rows = DATA.branches.map(b=>{
      const c = DATA.employees.filter(e=>e.branch===b.id);
      const active = c.filter(e=>e.status==="Active").length;
      return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${c.length}</td><td class="mono">${active}</td></tr>`;
    }).join("");
    return `Staff breakdown by branch:` + miniTable(["Branch","Total","Active"], rows);
  }

  // ---------- who manages X branch ----------
  if(anyWord(tokens,["manage","manager","manages","incharge","charge"])){
    const b = findBranch();
    if(b) return `<b>${b.manager}</b> manages ${b.name}. Reach them at ${b.phone}.`;
    const rows = DATA.branches.map(b=>`<tr><td>${b.name.replace("MediCore — ","")}</td><td>${b.manager}</td></tr>`).join("");
    return `Branch managers:` + miniTable(["Branch","Manager"], rows);
  }

  // ---------- specific product stock lookup (fallback) ----------
  const prod = findProduct();
  if(prod){
    const rows = DATA.branches.map(b=>`<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${prod.stock[b.id]||0}</td></tr>`).join("");
    return `${prod.name} (batch ${prod.batch}, expires ${prod.expiry}) — stock by branch:` + miniTable(["Branch","Stock"], rows);
  }

  return `I can answer questions about stock, sales, expenses, profit, and attendance — try asking things like "which branch is low on Panadol", "what's our profit this month", or "who's checked in today". For anything outside the app's data, you'd want a more general AI integration, which we can wire in during the build-out phase.`;
}

function miniTable(headers, rows){
  return `<div class="ai-mini-table"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ===================== LANDING + LOGIN =====================
function renderLanding(){
  $app.innerHTML = `
    <div class="gate">
      <div class="gate-nav">
        <div class="gate-brand">
          <div class="gate-brand-mark">M</div>
          <div class="gate-brand-name">MediCore</div>
        </div>
        <button class="btn" id="navSignIn">Sign in</button>
      </div>
      <div class="gate-hero">
        <div class="gate-eyebrow"><i class="ti ti-building-hospital"></i> Pharmacy ERP</div>
        <div class="gate-headline">Run every branch like your best one.</div>
        <div class="gate-sub">Real-time inventory, expiry tracking, and analytics across your pharmacy network — all in one calm, focused workspace.</div>
        <div class="gate-cta-row">
          <button class="btn btn-primary btn-lg" id="heroSignIn">Sign in to workspace</button>
        </div>
        <div class="gate-features">
          <div class="gate-feature"><i class="ti ti-building-store"></i> Multi-branch operations</div>
          <div class="gate-feature"><i class="ti ti-chart-line"></i> Live stock analytics</div>
          <div class="gate-feature"><i class="ti ti-shield-lock"></i> Role-based permissions</div>
        </div>
      </div>
      <div class="gate-foot">© 2026 MediCore Health Systems</div>
    </div>
  `;
  document.getElementById("navSignIn").addEventListener("click", ()=>{ VIEW="login"; render(); });
  document.getElementById("heroSignIn").addEventListener("click", ()=>{ VIEW="login"; render(); });
}

function renderLogin(){
  $app.innerHTML = `
    <div class="login-shell">
      <div style="width:380px;">
        <div class="login-back" id="backToLanding"><i class="ti ti-arrow-left"></i> Back</div>
        <div class="login-card">
          <div class="login-brand">
            <div class="gate-brand-mark">M</div>
            <div class="gate-brand-name">MediCore</div>
          </div>
          <div class="login-title" id="loginTitle">Welcome back</div>
          <div class="login-sub" id="loginSub">Sign in to your pharmacy workspace.</div>
          <div id="loginError" style="display:none; background:var(--red-100); color:var(--red-700); font-size:12.5px; padding:9px 12px; border-radius:7px; margin-bottom:14px;"></div>
          <div class="login-field">
            <label>Work email</label>
            <input id="loginEmail" type="email" placeholder="you@yourpharmacy.com">
          </div>
          <div class="login-field">
            <label>Password</label>
            <input id="loginPassword" type="password" placeholder="At least 6 characters">
          </div>
          <div class="login-row">
            <span></span>
            <a href="#" id="forgotLink">Forgot?</a>
          </div>
          <button class="btn btn-primary" style="width:100%; justify-content:center;" id="signInBtn">Sign in</button>
          <div class="login-note">
            <span id="toggleModeText">New pharmacy?</span>
            <a href="#" id="toggleModeLink" style="color:var(--teal-700);">Create an account</a>
          </div>
        </div>
      </div>
    </div>
  `;
  let mode = "signin"; // signin | signup

  document.getElementById("backToLanding").addEventListener("click", ()=>{ VIEW="landing"; render(); });
  document.getElementById("forgotLink").addEventListener("click", async (e)=>{
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    if(!email){ showLoginError("Enter your email above first, then click Forgot."); return; }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if(error) showLoginError(error.message);
    else showToastStandalone("Password reset email sent — check your inbox.");
  });

  document.getElementById("toggleModeLink").addEventListener("click", (e)=>{
    e.preventDefault();
    mode = mode === "signin" ? "signup" : "signin";
    document.getElementById("loginTitle").textContent = mode === "signin" ? "Welcome back" : "Create your workspace";
    document.getElementById("loginSub").textContent = mode === "signin" ? "Sign in to your pharmacy workspace." : "Set up MediCore for your pharmacy.";
    document.getElementById("signInBtn").textContent = mode === "signin" ? "Sign in" : "Create account";
    document.getElementById("toggleModeText").textContent = mode === "signin" ? "New pharmacy?" : "Already have an account?";
    document.getElementById("toggleModeLink").textContent = mode === "signin" ? "Create an account" : "Sign in";
    hideLoginError();
  });

  function showLoginError(msg){
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.style.display = "block";
  }
  function hideLoginError(){
    document.getElementById("loginError").style.display = "none";
  }

  const submit = async ()=>{
    hideLoginError();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    if(!email || !password){ showLoginError("Enter both email and password."); return; }
    const btn = document.getElementById("signInBtn");
    btn.disabled = true;
    btn.textContent = mode === "signin" ? "Signing in..." : "Creating account...";

    if(mode === "signin"){
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if(error){
        showLoginError(error.message);
        btn.disabled = false; btn.textContent = "Sign in";
        return;
      }
      await enterApp();
    }else{
      const { error } = await supabaseClient.auth.signUp({ email, password });
      if(error){
        showLoginError(error.message);
        btn.disabled = false; btn.textContent = "Create account";
        return;
      }
      // If email confirmation is off, Supabase returns a usable session right away.
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if(sessionData.session){
        await enterApp();
      }else{
        showToastStandalone("Account created — check your email to confirm, then sign in.");
        btn.disabled = false; btn.textContent = "Create account";
      }
    }
  };

  document.getElementById("signInBtn").addEventListener("click", submit);
  document.getElementById("loginPassword").addEventListener("keydown", (e)=>{ if(e.key==="Enter") submit(); });
}

async function enterApp(){
  VIEW = "app";
  await loadAppData();
}

function showToastStandalone(msg, icon="ti-info-circle"){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.innerHTML = `<i class="ti ${icon}"></i> ${msg}`;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=> t.classList.remove("show"), 2600);
}

// ===================== INIT =====================
async function loadAppData(){
  render(); // show "checking/loading" state immediately
  $app.innerHTML = `
    <div class="login-shell">
      <div style="display:flex; flex-direction:column; align-items:center; gap:14px; color:var(--ink-soft);">
        <div class="gate-brand-mark" style="width:40px; height:40px; font-size:18px;">M</div>
        <div style="font-size:13.5px;">Loading your pharmacy data...</div>
      </div>
    </div>
  `;
  try{
    await seedDemoDataIfEmpty();
    await fetchAllData();
    VIEW = "app";
    render();
  }catch(err){
    $app.innerHTML = `
      <div class="login-shell">
        <div class="login-card" style="width:420px;">
          <div class="login-title" style="color:var(--red-700);">Couldn't load data</div>
          <div class="login-sub">${(err && err.message) ? err.message : "Something went wrong talking to the database."}</div>
          <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:10px;" id="retryBtn">Try again</button>
        </div>
      </div>
    `;
    document.getElementById("retryBtn").addEventListener("click", loadAppData);
  }
}

async function initApp(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session){
    await loadAppData();
  }else{
    VIEW = "landing";
    render();
  }

  // Keep app in sync if the user logs out in another tab, or session expires
  supabaseClient.auth.onAuthStateChange((event, session)=>{
    if(event === "SIGNED_OUT" && VIEW === "app"){
      VIEW = "landing";
      render();
    }
  });
}

// Catch-all: if anything throws unexpectedly during startup, show it directly
// on the page instead of leaving the person stuck on a loading screen forever.
window.addEventListener("error", (e)=>{
  if(VIEW === "checking" || VIEW === "app"){
    document.getElementById("app").innerHTML = `
      <div class="login-shell">
        <div class="login-card" style="width:500px;">
          <div class="login-title" style="color:var(--red-700);">Something went wrong</div>
          <div class="login-sub" style="font-family:monospace; font-size:12px; word-break:break-word;">
            ${e.message || 'Unknown error'}<br>
            ${e.filename ? e.filename.split('/').pop() + ':' + e.lineno : ''}
          </div>
          <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:14px;" onclick="location.reload()">Reload page</button>
        </div>
      </div>
    `;
  }
});
window.addEventListener("unhandledrejection", (e)=>{
  if(VIEW === "checking" || VIEW === "app"){
    document.getElementById("app").innerHTML = `
      <div class="login-shell">
        <div class="login-card" style="width:500px;">
          <div class="login-title" style="color:var(--red-700);">Something went wrong</div>
          <div class="login-sub" style="font-family:monospace; font-size:12px; word-break:break-word;">
            ${(e.reason && e.reason.message) ? e.reason.message : String(e.reason)}
          </div>
          <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:14px;" onclick="location.reload()">Reload page</button>
        </div>
      </div>
    `;
  }
});

initApp();
