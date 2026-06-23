// ===== MERIDIAN PHARMACY APP =====

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
      <button class="btn btn-primary" id="