// ===== MEDICORE — DATA LAYER (Supabase-backed) =====
// All reads/writes go to your Supabase project now instead of the browser.

// In-memory cache the rest of the app reads from after loading.
// Shape matches the old localStorage version so the UI code barely changes:
// { branches: [...], products: [...with .stock = {branchId: qty}}], employees: [...] }
let DATA = { branches: [], products: [], employees: [], sales: [], purchases: [] };

async function fetchAllData(){
  const [branchesRes, productsRes, stockRes, employeesRes, salesRes, purchasesRes] = await Promise.all([
    supabaseClient.from("branches").select("*").order("created_at"),
    supabaseClient.from("products").select("*").order("created_at"),
    supabaseClient.from("stock_levels").select("*"),
    supabaseClient.from("employees").select("*").order("created_at"),
    supabaseClient.from("sales").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseClient.from("purchases").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if(branchesRes.error) throw branchesRes.error;
  if(productsRes.error) throw productsRes.error;
  if(stockRes.error) throw stockRes.error;
  if(employeesRes.error) throw employeesRes.error;
  if(salesRes.error) throw salesRes.error;
  if(purchasesRes.error) throw purchasesRes.error;

  const branches = (branchesRes.data || []).map(b => ({
    id: b.id, name: b.name, city: b.city, manager: b.manager || "Unassigned",
    phone: b.phone || "—", opened: b.opened || ""
  }));

  const products = (productsRes.data || []).map(p => {
    const stock = {};
    branches.forEach(b => stock[b.id] = 0);
    return {
      id: p.id, name: p.name, category: p.category || "General", batch: p.batch || "—",
      expiry: p.expiry || "2027-12-31", unitPrice: Number(p.unit_price) || 0,
      reorderLevel: p.reorder_level || 10, stock
    };
  });

  (stockRes.data || []).forEach(row => {
    const prod = products.find(p => p.id === row.product_id);
    if(prod) prod.stock[row.branch_id] = row.quantity;
  });

  const employees = (employeesRes.data || []).map(e => ({
    id: e.id, name: e.name, role: e.role || "Staff", branch: e.branch_id,
    phone: e.phone || "—", joined: e.joined || "", shift: e.shift || "Morning",
    status: e.status || "Active"
  }));

  const sales = (salesRes.data || []).map(s => ({
    id: s.id, branchId: s.branch_id, productId: s.product_id, quantity: s.quantity,
    unitPrice: Number(s.unit_price) || 0, customerName: s.customer_name || "Walk-in",
    createdAt: s.created_at
  }));

  const purchases = (purchasesRes.data || []).map(p => ({
    id: p.id, branchId: p.branch_id, productId: p.product_id, quantity: p.quantity,
    unitCost: Number(p.unit_cost) || 0, supplier: p.supplier || "—",
    createdAt: p.created_at
  }));

  DATA = { branches, products, employees, sales, purchases };
  return DATA;
}

// ---------- write helpers used by the app ----------

async function dbAddBranch({ name, city, manager, phone }){
  const { data, error } = await supabaseClient.from("branches")
    .insert({ name, city, manager, phone }).select().single();
  if(error) throw error;
  return data;
}

async function dbUpdateBranch(id, fields){
  const { error } = await supabaseClient.from("branches")
    .update({ name: fields.name, city: fields.city, manager: fields.manager, phone: fields.phone })
    .eq("id", id);
  if(error) throw error;
}

async function dbAddProduct({ name, category, batch, expiry, unitPrice, reorderLevel }){
  const { data, error } = await supabaseClient.from("products")
    .insert({ name, category, batch, expiry, unit_price: unitPrice, reorder_level: reorderLevel })
    .select().single();
  if(error) throw error;
  const rows = DATA.branches.map(b => ({ product_id: data.id, branch_id: b.id, quantity: 0 }));
  if(rows.length){
    const { error: stockErr } = await supabaseClient.from("stock_levels").insert(rows);
    if(stockErr) throw stockErr;
  }
  return data;
}

async function dbSetStock(productId, branchId, quantity){
  const { error } = await supabaseClient.from("stock_levels")
    .upsert({ product_id: productId, branch_id: branchId, quantity }, { onConflict: "product_id,branch_id" });
  if(error) throw error;
}

async function dbAddEmployee({ name, role, branch, phone, shift }){
  const { data, error } = await supabaseClient.from("employees")
    .insert({ name, role, branch_id: branch, phone, shift, status: "Active" })
    .select().single();
  if(error) throw error;
  return data;
}

async function dbUpdateEmployee(id, fields){
  const { error } = await supabaseClient.from("employees")
    .update({
      name: fields.name, role: fields.role, branch_id: fields.branch,
      phone: fields.phone, shift: fields.shift, status: fields.status
    }).eq("id", id);
  if(error) throw error;
}

// ---------- purchases & sales (stock-safe, atomic on the database side) ----------

async function dbRecordPurchase({ branchId, productId, quantity, unitCost, supplier }){
  const { data, error } = await supabaseClient.rpc("record_purchase", {
    p_branch_id: branchId, p_product_id: productId, p_quantity: quantity,
    p_unit_cost: unitCost, p_supplier: supplier
  });
  if(error) throw error;
  return data;
}

async function dbRecordSale({ branchId, productId, quantity, unitPrice, customerName }){
  const { data, error } = await supabaseClient.rpc("record_sale", {
    p_branch_id: branchId, p_product_id: productId, p_quantity: quantity,
    p_unit_price: unitPrice, p_customer_name: customerName
  });
  if(error) throw error;
  return data;
}

// ---------- one-time seed of demo data for a brand new pharmacy ----------
async function seedDemoDataIfEmpty(){
  const { count, error } = await supabaseClient.from("branches").select("*", { count: "exact", head: true });
  if(error) throw error;
  if(count && count > 0) return;

  const branchSeed = [
    { name: "MediCore — Gulberg", city: "Lahore", manager: "Hassan Raza", phone: "+92 42 3587 2210" },
    { name: "MediCore — DHA Phase 5", city: "Lahore", manager: "Ayesha Khalid", phone: "+92 42 3711 4490" },
    { name: "MediCore — Faisal Town", city: "Lahore", manager: "Bilal Ahmed", phone: "+92 42 3552 0871" },
  ];
  const { data: branches, error: bErr } = await supabaseClient.from("branches").insert(branchSeed).select();
  if(bErr) throw bErr;
  const [b1, b2, b3] = branches;

  const productSeed = [
    { name: "Panadol Extra", category: "Pain relief", batch: "PN2241", expiry: "2027-02-28", unit_price: 45, reorder_level: 50 },
    { name: "Augmentin 625mg", category: "Antibiotic", batch: "AG1187", expiry: "2026-09-15", unit_price: 320, reorder_level: 30 },
    { name: "Disprin", category: "Pain relief", batch: "DS3320", expiry: "2027-11-10", unit_price: 12, reorder_level: 100 },
    { name: "Brufen 400mg", category: "Anti-inflammatory", batch: "BR0094", expiry: "2026-07-01", unit_price: 38, reorder_level: 40 },
    { name: "Risek 20mg", category: "Antacid", batch: "RK7741", expiry: "2027-04-22", unit_price: 180, reorder_level: 25 },
    { name: "Calpol Syrup", category: "Pediatric", batch: "CP9012", expiry: "2026-08-05", unit_price: 95, reorder_level: 20 },
    { name: "Surbex-Z", category: "Vitamins", batch: "SX4456", expiry: "2027-01-30", unit_price: 210, reorder_level: 30 },
    { name: "Glucophage 500mg", category: "Diabetes", batch: "GP6623", expiry: "2026-12-12", unit_price: 150, reorder_level: 35 },
    { name: "Ventolin Inhaler", category: "Respiratory", batch: "VT3381", expiry: "2026-10-18", unit_price: 420, reorder_level: 15 },
    { name: "Amoxil 500mg", category: "Antibiotic", batch: "AX5567", expiry: "2026-06-30", unit_price: 110, reorder_level: 30 },
  ];
  const { data: products, error: pErr } = await supabaseClient.from("products").insert(productSeed).select();
  if(pErr) throw pErr;

  const stockSeed = [
    [320, 18, 140], [60, 95, 12], [480, 410, 390], [8, 140, 75], [95, 60, 5],
    [70, 55, 0], [140, 130, 160], [200, 15, 90], [25, 30, 4], [0, 40, 60],
  ];
  const stockRows = [];
  products.forEach((p, i) => {
    [b1, b2, b3].forEach((b, j) => stockRows.push({ product_id: p.id, branch_id: b.id, quantity: stockSeed[i][j] }));
  });
  const { error: sErr } = await supabaseClient.from("stock_levels").insert(stockRows);
  if(sErr) throw sErr;

  const employeeSeed = [
    { name: "Hassan Raza", role: "Branch Manager", branch_id: b1.id, phone: "+92 300 1234567", shift: "Morning" },
    { name: "Sara Tariq", role: "Pharmacist", branch_id: b1.id, phone: "+92 301 2345678", shift: "Morning" },
    { name: "Usman Javed", role: "Cashier", branch_id: b1.id, phone: "+92 302 3456789", shift: "Evening" },
    { name: "Ayesha Khalid", role: "Branch Manager", branch_id: b2.id, phone: "+92 303 4567890", shift: "Morning" },
    { name: "Imran Sheikh", role: "Pharmacist", branch_id: b2.id, phone: "+92 304 5678901", shift: "Evening" },
    { name: "Bilal Ahmed", role: "Branch Manager", branch_id: b3.id, phone: "+92 306 7890123", shift: "Morning" },
    { name: "Noor Fatima", role: "Pharmacist", branch_id: b3.id, phone: "+92 307 8901234", shift: "Evening" },
  ];
  const { error: eErr } = await supabaseClient.from("employees").insert(employeeSeed);
  if(eErr) throw eErr;
}