// ===== MEDICORE — DATA LAYER (Supabase-backed) =====
// All reads/writes go to your Supabase project now instead of the browser.

// In-memory cache the rest of the app reads from after loading.
// Shape matches the old localStorage version so the UI code barely changes:
// { branches: [...], products: [...with .stock = {branchId: qty}}], employees: [...] }
let DATA = { branches: [], products: [], employees: [], sales: [], purchases: [], suppliers: [], transfers: [], expenses: [], recurringExpenses: [], attendance: [] };

async function fetchAllData(){
  const [branchesRes, productsRes, stockRes, employeesRes, salesRes, purchasesRes, suppliersRes, transfersRes, expensesRes, recurringRes, attendanceRes] = await Promise.all([
    supabaseClient.from("branches").select("*").order("created_at"),
    supabaseClient.from("products").select("*").order("created_at"),
    supabaseClient.from("stock_levels").select("*"),
    supabaseClient.from("employees").select("*").order("created_at"),
    supabaseClient.from("sales").select("*").order("created_at", { ascending: false }).limit(300),
    supabaseClient.from("purchases").select("*").order("created_at", { ascending: false }).limit(300),
    supabaseClient.from("suppliers").select("*").order("created_at"),
    supabaseClient.from("stock_transfers").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseClient.from("expenses").select("*").order("expense_date", { ascending: false }).limit(300),
    supabaseClient.from("recurring_expenses").select("*"),
    supabaseClient.from("attendance").select("*").order("check_in", { ascending: false }).limit(500),
  ]);

  if(branchesRes.error) throw branchesRes.error;
  if(productsRes.error) throw productsRes.error;
  if(stockRes.error) throw stockRes.error;
  if(employeesRes.error) throw employeesRes.error;
  if(salesRes.error) throw salesRes.error;
  if(purchasesRes.error) throw purchasesRes.error;
  if(suppliersRes.error) throw suppliersRes.error;
  if(transfersRes.error) throw transfersRes.error;
  if(expensesRes.error) throw expensesRes.error;
  if(recurringRes.error) throw recurringRes.error;
  if(attendanceRes.error) throw attendanceRes.error;

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
      reorderLevel: p.reorder_level || 10, barcode: p.barcode || "", stock
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

  const suppliers = (suppliersRes.data || []).map(s => ({
    id: s.id, name: s.name, contactPerson: s.contact_person || "—",
    phone: s.phone || "—", email: s.email || "—"
  }));

  const transfers = (transfersRes.data || []).map(t => ({
    id: t.id, productId: t.product_id, fromBranchId: t.from_branch_id, toBranchId: t.to_branch_id,
    quantity: t.quantity, status: t.status || "completed", createdAt: t.created_at
  }));

  const expenses = (expensesRes.data || []).map(e => ({
    id: e.id, branchId: e.branch_id, category: e.category, description: e.description || "",
    amount: Number(e.amount) || 0, expenseDate: e.expense_date, createdAt: e.created_at
  }));

  const recurringExpenses = (recurringRes.data || []).map(r => ({
    id: r.id, branchId: r.branch_id, category: r.category, amount: Number(r.amount) || 0, active: r.active
  }));

  const attendance = (attendanceRes.data || []).map(a => ({
    id: a.id, employeeId: a.employee_id, branchId: a.branch_id,
    checkIn: a.check_in, checkOut: a.check_out, status: a.status || "present"
  }));

  DATA = { branches, products, employees, sales, purchases, suppliers, transfers, expenses, recurringExpenses, attendance };
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

async function dbAddProduct({ name, category, batch, expiry, unitPrice, reorderLevel, barcode }){
  const { data, error } = await supabaseClient.from("products")
    .insert({ name, category, batch, expiry, unit_price: unitPrice, reorder_level: reorderLevel, barcode: barcode || null })
    .select().single();
  if(error) throw error;
  // seed a zero stock row for every existing branch
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

// POS checkout: cart is an array of { productId, quantity, unitPrice }
async function dbRecordPosSale({ branchId, customerName, cart }){
  const items = cart.map(c => ({ product_id: c.productId, quantity: c.quantity, unit_price: c.unitPrice }));
  const { data, error } = await supabaseClient.rpc("record_pos_sale", {
    p_branch_id: branchId, p_customer_name: customerName || "Walk-in", p_items: items
  });
  if(error) throw error;
  return data;
}

async function dbRecordTransfer({ productId, fromBranchId, toBranchId, quantity }){
  const { data, error } = await supabaseClient.rpc("record_stock_transfer", {
    p_product_id: productId, p_from_branch_id: fromBranchId, p_to_branch_id: toBranchId, p_quantity: quantity
  });
  if(error) throw error;
  return data;
}

async function dbAddSupplier({ name, contactPerson, phone, email }){
  const { data, error } = await supabaseClient.from("suppliers")
    .insert({ name, contact_person: contactPerson, phone, email }).select().single();
  if(error) throw error;
  return data;
}

// ---------- expenses & profit ----------

async function dbAddExpense({ branchId, category, description, amount, expenseDate }){
  const { data, error } = await supabaseClient.from("expenses")
    .insert({ branch_id: branchId, category, description, amount, expense_date: expenseDate })
    .select().single();
  if(error) throw error;
  return data;
}

// Recurring expenses are one row per branch+category — setting it again updates the amount.
async function dbSetRecurringExpense({ branchId, category, amount, active }){
  const { data, error } = await supabaseClient.from("recurring_expenses")
    .upsert({ branch_id: branchId, category, amount, active: active !== false }, { onConflict: "branch_id,category" })
    .select().single();
  if(error) throw error;
  return data;
}

async function dbDeleteRecurringExpense(id){
  const { error } = await supabaseClient.from("recurring_expenses").delete().eq("id", id);
  if(error) throw error;
}

// ---------- attendance ----------

async function dbCheckIn({ employeeId, branchId }){
  const { data, error } = await supabaseClient.rpc("employee_check_in", {
    p_employee_id: employeeId, p_branch_id: branchId
  });
  if(error) throw error;
  return data;
}

async function dbCheckOut({ employeeId }){
  const { data, error } = await supabaseClient.rpc("employee_check_out", {
    p_employee_id: employeeId
  });
  if(error) throw error;
  return data;
}

async function dbRecordAbsence({ employeeId, branchId, status, date }){
  const { data, error } = await supabaseClient.rpc("record_absence", {
    p_employee_id: employeeId, p_branch_id: branchId, p_status: status, p_date: date
  });
  if(error) throw error;
  return data;
}

// ---------- one-time seed of demo data for a brand new pharmacy ----------
// Only runs if the database is completely empty, so a fresh Supabase
// project still demos well on first login.
async function seedDemoDataIfEmpty(){
  const { count, error } = await supabaseClient.from("branches").select("*", { count: "exact", head: true });
  if(error) throw error;
  if(count && count > 0) return; // already has real data, don't touch it

  const branchSeed = [
    { name: "MediCore — Gulberg", city: "Lahore", manager: "Hassan Raza", phone: "+92 42 3587 2210" },
    { name: "MediCore — DHA Phase 5", city: "Lahore", manager: "Ayesha Khalid", phone: "+92 42 3711 4490" },
    { name: "MediCore — Faisal Town", city: "Lahore", manager: "Bilal Ahmed", phone: "+92 42 3552 0871" },
  ];
  const { data: branches, error: bErr } = await supabaseClient.from("branches").insert(branchSeed).select();
  if(bErr) throw bErr;
  const [b1, b2, b3] = branches;

  // ---------- 5 suppliers ----------
  const supplierSeed = [
    { name: "Getz Pharma Distribution", contact_person: "Faisal Mehmood", phone: "+92 21 3454 1100", email: "orders@getzdist.pk" },
    { name: "GSK Pakistan Trading Co.", contact_person: "Aisha Noor", phone: "+92 21 3567 2200", email: "sales@gsktrading.pk" },
    { name: "Abbott Healthcare Supply", contact_person: "Tariq Mahmood", phone: "+92 42 3711 8800", email: "supply@abbotthc.pk" },
    { name: "Hilton Pharma Wholesale", contact_person: "Zainab Sheikh", phone: "+92 42 3590 3300", email: "wholesale@hiltonpharma.pk" },
    { name: "Wilson's Pharmaceutical Traders", contact_person: "Omar Farooq", phone: "+92 21 3622 4400", email: "trade@wilsonspharma.pk" },
  ];
  const { data: suppliers, error: supErr } = await supabaseClient.from("suppliers").insert(supplierSeed).select();
  if(supErr) throw supErr;

  // ---------- 5 employees ----------
  const employeeSeed = [
    { name: "Hassan Raza", role: "Branch Manager", branch_id: b1.id, phone: "+92 300 1234567", shift: "Morning" },
    { name: "Sara Tariq", role: "Pharmacist", branch_id: b1.id, phone: "+92 301 2345678", shift: "Morning" },
    { name: "Ayesha Khalid", role: "Branch Manager", branch_id: b2.id, phone: "+92 303 4567890", shift: "Morning" },
    { name: "Imran Sheikh", role: "Pharmacist", branch_id: b2.id, phone: "+92 304 5678901", shift: "Evening" },
    { name: "Bilal Ahmed", role: "Branch Manager", branch_id: b3.id, phone: "+92 306 7890123", shift: "Morning" },
  ];
  const { error: eErr } = await supabaseClient.from("employees").insert(employeeSeed);
  if(eErr) throw eErr;

  // ---------- 100 medicines, generated with realistic variety ----------
  const categories = ["Pain relief","Antibiotic","Anti-inflammatory","Antacid","Pediatric","Vitamins","Diabetes","Respiratory","Cardiac","Dermatology","Antifungal","Antiviral","Antihistamine","Antiseptic","Supplements"];
  const baseNames = [
    "Panadol Extra","Augmentin","Disprin","Brufen","Risek","Calpol Syrup","Surbex-Z","Glucophage","Ventolin Inhaler","Amoxil",
    "Centrum Silver","Flagyl","Panadol CF","Arinac Forte","Cital","Nuberol Forte","Buscopan","Motilium","Rigix","Zinetac",
    "Maxalief","Veneray","Calpol","Dolarac","Caflam","Arthrofen","Synflex","Nimaday","Tegral","Tab Lyrica",
    "Concor","Norvasc","Lipiget","Stamlo","Cardace","Lasix","Aldactone","Inderal","Plavix","Ecosprin",
    "Ventide Inhaler","Asthalin","Deriphyllin","Montair","Allerfix","Avil","Zyrtec","Telfast","Claritine","Rinos",
    "Septran","Klacid","Zinnat","Cifran","Levoflox","Azomax","Cefspan","Moxiget","Rocephin","Trazine",
    "Cetraxal","Fungin","Candid-B","Lamisil","Daktarin","Mycoderm","Ketocon","Terbisil","Itracon","Flucos",
    "Glucobay","Diamicron","Janumet","Daonil","Amaryl","Insulin Novomix","Insupen","Glycomet","Diabetab","Sugacon",
    "Surbex Gold","Neurobion","Becosules","Calcimax","Ostocalcium","Folart","Iberet","Hemfar","Ferrofol","Zincovit",
    "Maxgalin","Ulcerfin","Pansec","Omec","Cinod","Nexium","Pariet","Gaviscon","Digene","Eno Sachet"
  ];

  const today = new Date("2026-06-21");
  function addMonths(d, m){ const r = new Date(d); r.setMonth(r.getMonth()+m); return r.toISOString().slice(0,10); }
  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  const productSeed = baseNames.map((name, i) => {
    const category = categories[i % categories.length];
    const unitPrice = rand(8, 650);
    // Spread expiry dates realistically: some soon (testing alerts), most far out
    let expiryMonths;
    const roll = i % 12;
    if(roll === 0) expiryMonths = rand(1,2);       // expiring very soon
    else if(roll === 1) expiryMonths = rand(2,4);  // expiring soon-ish
    else expiryMonths = rand(6,24);                 // healthy
    return {
      name, category,
      batch: (category.slice(0,2).toUpperCase()) + rand(1000,9999),
      expiry: addMonths(today, expiryMonths),
      unit_price: unitPrice,
      reorder_level: rand(15,60),
      barcode: "8" + String(rand(100000000000, 999999999999))
    };
  });

  const { data: products, error: pErr } = await supabaseClient.from("products").insert(productSeed).select();
  if(pErr) throw pErr;

  // ---------- realistic stock levels per branch ----------
  const stockRows = [];
  products.forEach((p, i) => {
    [b1, b2, b3].forEach((b) => {
      // a handful of products are deliberately low/out of stock so alerts have something to show
      const roll = i % 17;
      let qty;
      if(roll === 0) qty = 0;
      else if(roll === 1 || roll === 2) qty = rand(1, 12);
      else qty = rand(20, 400);
      stockRows.push({ product_id: p.id, branch_id: b.id, quantity: qty });
    });
  });
  const { error: sErr } = await supabaseClient.from("stock_levels").insert(stockRows);
  if(sErr) throw sErr;

  // ---------- 5 sample purchases (so stock has a paper trail) ----------
  const purchaseRows = [];
  for(let i=0; i<5; i++){
    const p = pick(products);
    const b = pick(branches);
    const s = pick(suppliers);
    purchaseRows.push({
      product_id: p.id, branch_id: b.id, quantity: rand(50,200),
      unit_cost: Math.round(p.unit_price * 0.6), supplier: s.name,
      created_at: new Date(today.getTime() - rand(1,20)*86400000).toISOString()
    });
  }
  const { error: purErr } = await supabaseClient.from("purchases").insert(purchaseRows);
  if(purErr) throw purErr;

  // ---------- 10 sample sales transactions ----------
  const customerNames = ["Walk-in","Ahmed Bashir","Fatima Noor","Walk-in","Usman Tariq","Walk-in","Sana Malik","Walk-in","Kamran Yousaf","Walk-in"];
  const saleRows = [];
  for(let i=0; i<10; i++){
    const p = pick(products);
    const b = pick(branches);
    const qty = rand(1,6);
    saleRows.push({
      product_id: p.id, branch_id: b.id, quantity: qty, unit_price: p.unit_price,
      customer_name: customerNames[i],
      created_at: new Date(today.getTime() - rand(0,6)*86400000 - rand(0,80000)*1000).toISOString()
    });
  }
  const { error: saleErr } = await supabaseClient.from("sales").insert(saleRows);
  if(saleErr) throw saleErr;
}
