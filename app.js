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
  { id:"branches", label:"Branches", icon:"ti-building-store" },
  { id:"inventory", label:"Inventory", icon:"ti-boxes" },
  { id:"sales", label:"Sales", icon:"ti-receipt" },
  { id:"purchases", label:"Purchases", icon:"ti-truck-delivery" },
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
    branches: ["Branches", "Manage your pharmacy locations"],
    inventory: ["Inventory", "Stock levels, batches, and expiry"],
    sales: ["Sales", "Record sales and track revenue"],
    purchases: ["Purchases", "Record incoming stock from suppliers"],
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
    case "branches": return renderBranches();
    case "inventory": return renderInventory();
    case "sales": return renderSales();
    case "purchases": return renderPurchases();
    case "employees": return renderEmployees();
    case "assistant": return renderAssistant();
    default: return "";
  }
}

function attachPageHandlers(){
  switch(STATE.page){
    case "dashboard": attachDashboardHandlers(); break;
    case "branches": attachBranchHandlers(); break;
    case "inventory": attachInventoryHandlers(); break;
    case "sales": attachSalesHandlers(); break;
    case "purchases": attachPurchasesHandlers(); break;
    case "employees": attachEmployeeHandlers(); break;
    case "assistant": attachAssistantHandlers(); break;
  }
}

// ===================== DASHBOARD =====================
function renderDashboard(){
  const scopeProducts = DATA.products;
  const totalValue = scopeProducts.reduce((sum,p)=> sum + stockForBranch(p, STATE.activeBranch) * p.unitPrice, 0);
  const lowCount = scopeProducts.filter(p => stockStatus(stockForBranch(p, STATE.activeBranch), p.reorderLevel) === "low").length;
  const outCount = scopeProducts.filter(p => stockStatus(stockForBranch(p, STATE.activeBranch), p.reorderLevel) === "out").length;
  const empCount = STATE.activeBranch==="all" ? DATA.employees.length : DATA.employees.filter(e=>e.branch===STATE.activeBranch).length;

  const expiringSoon = scopeProducts
    .map(p=>({...p, days: daysUntil(p.expiry)}))
    .filter(p=>p.days <= 120)
    .sort((a,b)=>a.days-b.days)
    .slice(0,5);

  const criticalStock = scopeProducts
    .map(p=>({...p, qty: stockForBranch(p, STATE.activeBranch)}))
    .filter(p=> stockStatus(p.qty, p.reorderLevel) !== "ok")
    .sort((a,b)=>a.qty-b.qty)
    .slice(0,5);

  return `
    <div class="metric-row">
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-currency-rupee"></i> Inventory value</div>
        <div class="metric-value">${fmtMoney(totalValue)}</div>
        <div class="metric-delta up">Across ${STATE.activeBranch==='all' ? DATA.branches.length+' branches' : 'this branch'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-boxes"></i> Products tracked</div>
        <div class="metric-value">${scopeProducts.length}</div>
        <div class="metric-delta up">SKUs in catalogue</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-alert-triangle"></i> Low or out of stock</div>
        <div class="metric-value" style="color:${lowCount+outCount>0?'var(--amber-600)':'inherit'}">${lowCount+outCount}</div>
        <div class="metric-delta ${lowCount+outCount>0?'down':'up'}">${outCount} out &middot; ${lowCount} low</div>
      </div>
      <div class="metric-card">
        <div class="metric-label"><i class="ti ti-users"></i> Staff</div>
        <div class="metric-value">${empCount}</div>
        <div class="metric-delta up">${DATA.employees.filter(e=>e.status==='Active').length} active total</div>
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
        <div style="font-size:12.5px; color:var(--ink-soft);">"Which branch needs Amoxil restocked?" or "Compare staff across branches"</div>
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
      <button class="btn btn-primary" id="// ===================== INVENTORY =====================
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
    const expiry = document.getElementById("f_expiry").value;
    const unitPrice = parseFloat(document.getElementById("f_price").value) || 0;
    const reorderLevel = parseInt(document.getElementById("f_reorder").value, 10) || 10;
    if(!name || !category){ showToast("Please fill in product name and category", "ti-alert-circle"); return; }
    const btn = document.getElementById("saveProductBtn");
    btn.disabled = true; btn.textContent = "Saving...";
    try{
      await dbAddProduct({ name, category, batch: batch || "—", expiry: expiry || "2027-12-31", unitPrice, reorderLevel });
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
  "Show items expiring in the next 60 days",
  "What's our total revenue?",
  "What are our top selling products?",
  "Which products are out of stock?",
  "Who manages the DHA Phase 5 branch?"
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
function answerQuery(raw){
  const q = raw.toLowerCase();
  const branchByName = (name) => DATA.branches.find(b => b.name.toLowerCase().includes(name) || name.includes(b.city.toLowerCase()));
  const findProduct = () => DATA.products.find(p => q.includes(p.name.toLowerCase().split(" ")[0].toLowerCase()));

  // out of stock
  if(q.includes("out of stock") || q.includes("zero stock")){
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

  // low stock / which branch low on X
  if(q.includes("low") || q.includes("restock") || q.includes("reorder")){
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

  // expiring
  if(q.includes("expir")){
    const days = q.match(/(\d+)\s*day/);
    const limit = days ? parseInt(days[1],10) : 120;
    const items = DATA.products.map(p=>({...p, d: daysUntil(p.expiry)})).filter(p=>p.d <= limit).sort((a,b)=>a.d-b.d);
    if(items.length===0) return `Nothing is expiring within ${limit} days. Your stock is in good shape.`;
    const rows = items.map(p=>`<tr><td>${p.name}</td><td class="mono">${p.batch}</td><td class="mono">${p.d} days</td></tr>`).join("");
    return `${items.length} product${items.length>1?'s':''} expiring within ${limit} days:` + miniTable(["Product","Batch","Time left"], rows);
  }

  // inventory value
  if(q.includes("value") || q.includes("worth")){
    const total = DATA.products.reduce((s,p)=> s + totalStock(p)*p.unitPrice, 0);
    const rows = DATA.branches.map(b=>{
      const v = DATA.products.reduce((s,p)=> s + (p.stock[b.id]||0)*p.unitPrice, 0);
      return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${fmtMoney(v)}</td></tr>`;
    }).join("");
    return `Total inventory value across all branches is <b>${fmtMoney(total)}</b>.` + miniTable(["Branch","Value"], rows);
  }

  // revenue / sales
  if(q.includes("revenue") || q.includes("sales") || q.includes("sold") || q.includes("selling")){
    if(DATA.sales.length === 0) return "No sales have been recorded yet. Use the Sales page to log your first one.";
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

  // purchases / restocking history
  if(q.includes("purchase") || q.includes("supplier") || q.includes("received")){
    if(DATA.purchases.length === 0) return "No purchases have been recorded yet. Use the Purchases page to log stock coming in from suppliers.";
    const totalCost = DATA.purchases.reduce((s,x)=> s + x.quantity*x.unitCost, 0);
    const productName = (id) => (DATA.products.find(p=>p.id===id)||{}).name || "Unknown";
    const recent = DATA.purchases.slice(0,5).map(p=>`<tr><td>${productName(p.productId)}</td><td class="mono">${p.quantity}</td><td>${p.supplier}</td></tr>`).join("");
    return `Total spent on purchases is <b>${fmtMoney(totalCost)}</b> across ${DATA.purchases.length} orders. Most recent:` + miniTable(["Product","Qty","Supplier"], recent);
  }

  // staff comparison
  if((q.includes("staff") || q.includes("employee")) && (q.includes("compare") || q.includes("across") || q.includes("how many") || q.includes("count"))){
    const rows = DATA.branches.map(b=>{
      const c = DATA.employees.filter(e=>e.branch===b.id);
      const active = c.filter(e=>e.status==="Active").length;
      return `<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${c.length}</td><td class="mono">${active}</td></tr>`;
    }).join("");
    return `Staff breakdown by branch:` + miniTable(["Branch","Total","Active"], rows);
  }

  // who manages X branch
  if(q.includes("manage") || q.includes("manager")){
    const b = DATA.branches.find(b => q.includes(b.city.toLowerCase()) || b.name.toLowerCase().split("—")[1] && q.includes(b.name.toLowerCase().split("—")[1].trim().split(" ")[0]));
    if(b) return `<b>${b.manager}</b> manages ${b.name}. Reach them at ${b.phone}.`;
    const rows = DATA.branches.map(b=>`<tr><td>${b.name.replace("MediCore — ","")}</td><td>${b.manager}</td></tr>`).join("");
    return `Branch managers:` + miniTable(["Branch","Manager"], rows);
  }

  // specific product stock lookup
  const prod = findProduct();
  if(prod){
    const rows = DATA.branches.map(b=>`<tr><td>${b.name.replace("MediCore — ","")}</td><td class="mono">${prod.stock[b.id]||0}</td></tr>`).join("");
    return `${prod.name} (batch ${prod.batch}, expires ${prod.expiry}) — stock by branch:` + miniTable(["Branch","Stock"], rows);
  }

  return `I can answer questions about stock levels, expiry dates, staff, and branches — try asking things like "which branch is low on Panadol" or "show expiring items". For anything outside the app's data, you'd want a more general AI integration, which we can wire in during the build-out phase.`;
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
    const email 