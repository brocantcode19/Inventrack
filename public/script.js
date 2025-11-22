// --- 1. Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, addDoc, deleteDoc, updateDoc, onSnapshot, 
    collection, query, orderBy, serverTimestamp, runTransaction, where, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDikTDPF2yW-dPXUCKD5KrY6gyObAfqxOQ",
  authDomain: "inventory-tracker-d0662.firebaseapp.com",
  projectId: "inventory-tracker-d0662",
  storageBucket: "inventory-tracker-d0662.firebasestorage.app",
  messagingSenderId: "183173369680",
  appId: "1:183173369680:web:d27157796d19114d59ed03"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Demo mode flag: default can be toggled via URL (?demo=true or ?demo=false)
const IS_DEMO_MODE = (() => {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('demo')) return params.get('demo') === 'true';
    } catch (e) {
        // ignore
    }
    // Default to true for portfolio demo; set ?demo=false to disable
    return true;
})();

// --- 2. Global State & DOM Elements ---
const loginPage = document.getElementById('login-page');
const appDashboard = document.getElementById('app-dashboard');
let allItems = []; // Cache for dropdowns

// --- Validation Utilities ---
function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.includes('@') && email.indexOf('@') !== 0 && email.indexOf('@') !== email.length - 1;
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Use libphonenumber-js for strict validation
    try {
        // libphonenumber-js exposes a global 'libphonenumber' object
        const { parsePhoneNumberFromString } = window.libphonenumber;
        if (!parsePhoneNumberFromString) return false;
        const parsed = parsePhoneNumberFromString(phone);
        return parsed && parsed.isValid();
    } catch (e) {
        return false;
    }
}

// --- 3. Auth Logic ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginPage.classList.add('hidden');
        appDashboard.classList.remove('hidden');
        document.getElementById('user-display-email').textContent = user.email;
        document.getElementById('user-id-display').textContent = `ID: ${user.uid}`;
        initializeDashboard();
    } else {
        loginPage.classList.remove('hidden');
        appDashboard.classList.add('hidden');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Demo-mode bypass: allow signing in without Firebase auth
    if (typeof IS_DEMO_MODE !== 'undefined' && IS_DEMO_MODE) {
        try {
            // Show dashboard UI immediately
            loginPage.classList.add('hidden');
            appDashboard.classList.remove('hidden');
            document.getElementById('user-display-email').textContent = email || 'Demo User';
            document.getElementById('user-id-display').textContent = 'ID: demo';
            showMessage('Signed in (Demo)', 'success');
            // Initialize dashboard (this will use demo data when IS_DEMO_MODE)
            initializeDashboard();
        } catch (err) {
            console.warn('Demo sign-in failed', err);
            showMessage('Demo sign-in failed', 'error');
        }
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const signedInEmail = (userCredential && userCredential.user && userCredential.user.email)
            ? userCredential.user.email.toLowerCase().trim()
            : (email||'').toLowerCase().trim();

        // Hard-coded staff account check
        if (signedInEmail === 'batilonaella@gmail.com') {
            showMessage('Login successful (Staff)', 'success');
            window.location.href = 'staff.html';
            return;
        }

        // Look up role in Firestore 'users' collection
        try {
            const q = query(collection(db, 'users'), where('email', '==', signedInEmail));
            const qs = await getDocs(q);
            let foundRole = null;
            qs.forEach(d => { const data = d.data(); if (data && data.role) foundRole = data.role; });
            if (foundRole && String(foundRole).toLowerCase() === 'staff') {
                showMessage('Login successful (Staff)', 'success');
                window.location.href = 'staff.html';
                return;
            }
        } catch (roleErr) {
            console.warn('Role lookup failed', roleErr);
        }

        // Default to admin/dashboard
        showMessage('Login successful', 'success');
        window.location.href = 'index.html';
    } catch (err) {
        showMessage(err.message, 'error');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => showMessage('Logged out', 'success'));
});

// --- 4. Navigation ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = e.currentTarget.dataset.page;
        // Hide all pages (Tailwind hidden) and remove any previous 'active' marker
        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
            p.classList.remove('active');
        });

        // Show the requested page by removing 'hidden' and adding 'active'
        const target = document.getElementById(`${pageId}-section`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active');
        }

        // Update page title if present (guard against missing element)
        const pageTitleEl = document.getElementById('page-title');
        if (pageTitleEl) pageTitleEl.textContent = pageId.charAt(0).toUpperCase() + pageId.slice(1);

        // Mobile close
        if (window.innerWidth < 768) document.getElementById('app-sidebar').classList.add('hidden');
    });
});
document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('app-sidebar').classList.toggle('hidden');
});

// --- 5. Dashboard Initialization ---
function initializeDashboard() {
    setupItems();
    setupSuppliers();
    setupUsers();
    setupTransactions();
}

// --- 6. ITEMS CRUD ---
function setupItems() {
    const tbody = document.getElementById('items-table-body');
    const itemSelects = [document.getElementById('stock-in-item'), document.getElementById('stock-out-item')];

    // READ
    if (!IS_DEMO_MODE) {
        onSnapshot(query(collection(db, 'items'), orderBy('name')), (snapshot) => {
            const itemsArr = [];
            let html = '';
            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                itemsArr.push(item);
                html += `
                    <tr class="border-b border-border hover:bg-card-header/50">
                        <td class="p-4 font-semibold">${item.name}</td>
                        <td class="p-4 text-text-secondary">${item.sku || '-'}</td>
                        <td class="p-4">${item.category || '-'}</td>
                        <td class="p-4 ${item.stock < 10 ? 'text-red-400 font-bold' : 'text-green-400'}">${item.stock}</td>
                            <td class="p-4">₱${Number(item.price).toFixed(2)}</td>
                        <td class="p-4 flex gap-2">
                            <button onclick="openEditItemModal('${item.id}')" class="text-blue-400 hover:text-white"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                            <button onclick="deleteItem('${item.id}')" class="text-red-400 hover:text-white"><i data-feather="trash" class="w-4 h-4"></i></button>
                        </td>
                    </tr>`;
            });
            allItems = itemsArr;
            tbody.innerHTML = html;
            feather.replace();

            // Update dropdowns
            const options = '<option value="">Select Item...</option>' + allItems.map(i => `<option value="${i.id}">${i.name} (Stock: ${i.stock})</option>`).join('');
            itemSelects.forEach(s => s.innerHTML = options);
        });
    }

    // CREATE
    document.getElementById('add-item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (checkDemoMode()) {
            // Close add modal and reset form to avoid leaving UI in an edit state
            try { closeModal(document.getElementById('add-item-modal')); } catch (er) {}
            try { form.reset(); } catch (er) {}
            return;
        }
        try {
            await addDoc(collection(db, 'items'), {
                name: form.name.value,
                sku: form.sku.value,
                category: form.category.value,
                stock: Number(form.stock.value),
                price: Number(form.price.value),
                createdAt: serverTimestamp()
            });
            showMessage('Item added', 'success');
            closeModal(document.getElementById('add-item-modal'));
            form.reset();
        } catch (err) { showMessage(err.message, 'error'); }
    });

    // UPDATE
    document.getElementById('edit-item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-item-id').value;
        if (checkDemoMode()) {
            try { closeModal(document.getElementById('edit-item-modal')); } catch (er) {}
            return;
        }
        try {
            await updateDoc(doc(db, 'items', id), {
                name: document.getElementById('edit-item-name').value,
                sku: document.getElementById('edit-item-sku').value,
                category: document.getElementById('edit-item-category').value,
                stock: Number(document.getElementById('edit-item-stock').value),
                price: Number(document.getElementById('edit-item-price').value)
            });
            showMessage('Item updated', 'success');
            closeModal(document.getElementById('edit-item-modal'));
        } catch (err) { showMessage(err.message, 'error'); }
    });
}

// Expose functions to global scope for HTML onclick attributes
window.openEditItemModal = (id) => {
    const item = allItems.find(i => i.id === id);
    if(item) {
        document.getElementById('edit-item-id').value = item.id;
        document.getElementById('edit-item-name').value = item.name;
        document.getElementById('edit-item-sku').value = item.sku;
        document.getElementById('edit-item-category').value = item.category;
        document.getElementById('edit-item-stock').value = item.stock;
        document.getElementById('edit-item-price').value = item.price;
        openModal(document.getElementById('edit-item-modal'));
    }
};

window.deleteItem = async (id) => {
    if (checkDemoMode()) return;
    if(confirm('Delete this item?')) {
        try { await deleteDoc(doc(db, 'items', id)); showMessage('Item deleted', 'success'); }
        catch(err) { showMessage(err.message, 'error'); }
    }
};


// --- 7. SUPPLIERS CRUD ---
function setupSuppliers() {
    const tbody = document.getElementById('suppliers-table-body');
    let suppliersCache = [];

    onSnapshot(collection(db, 'suppliers'), (snapshot) => {
        suppliersCache = [];
        let html = '';
        snapshot.forEach(doc => {
            const s = { id: doc.id, ...doc.data() };
            suppliersCache.push(s);
            html += `
                <tr class="border-b border-border hover:bg-card-header/50">
                    <td class="p-4 font-semibold">${s.name}</td>
                    <td class="p-4 text-text-secondary">${s.contact || '-'}</td>
                    <td class="p-4">${s.phone || '-'}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="openEditSupplierModal('${s.id}')" class="text-blue-400 hover:text-white"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="deleteSupplier('${s.id}')" class="text-red-400 hover:text-white"><i data-feather="trash" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
        feather.replace();
    });
    // In demo mode we skip real-time listener and rely on loadDemoData()
    if (IS_DEMO_MODE) {
        // no-op: demo data will be loaded separately
    }

    // CREATE
    document.getElementById('add-supplier-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (checkDemoMode()) {
            try { e.target.reset(); } catch (er) {}
            return;
        }
        const form = e.target;
        const countryCode = (form.countryCode && form.countryCode.value || '').trim();
        const phoneRaw = (form.phone && form.phone.value || '').trim();
        const phoneVal = countryCode + phoneRaw.replace(/^\+/, '');
        if (!validatePhone(phoneVal)) return showMessage('Phone must be valid and include country code', 'error');
        try {
            await addDoc(collection(db, 'suppliers'), {
                name: form.name.value,
                contact: form.contact.value,
                email: form.email.value,
                phone: phoneVal
            });
            showMessage('Supplier added', 'success');
            form.reset();
        } catch (err) { showMessage(err.message, 'error'); }
    });

    // UPDATE
    document.getElementById('edit-supplier-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-supplier-id').value;
        if (checkDemoMode()) {
            try { closeModal(document.getElementById('edit-supplier-modal')); } catch (er) {}
            return;
        }
        const phoneVal = (document.getElementById('edit-supplier-phone') && document.getElementById('edit-supplier-phone').value || '').trim();
        if (phoneVal && !validatePhone(phoneVal)) return showMessage('Phone must include country code (e.g., +1)', 'error');
        try {
            await updateDoc(doc(db, 'suppliers', id), {
                name: document.getElementById('edit-supplier-name').value,
                contact: document.getElementById('edit-supplier-contact').value,
                email: document.getElementById('edit-supplier-email').value,
                phone: phoneVal
            });
            showMessage('Supplier updated', 'success');
            closeModal(document.getElementById('edit-supplier-modal'));
        } catch (err) { showMessage(err.message, 'error'); }
    });

    window.openEditSupplierModal = (id) => {
        const s = suppliersCache.find(i => i.id === id);
        if(s) {
            document.getElementById('edit-supplier-id').value = s.id;
            document.getElementById('edit-supplier-name').value = s.name;
            document.getElementById('edit-supplier-contact').value = s.contact;
            document.getElementById('edit-supplier-email').value = s.email;
            document.getElementById('edit-supplier-phone').value = s.phone;
            openModal(document.getElementById('edit-supplier-modal'));
        }
    };

    window.deleteSupplier = async (id) => {
        if (checkDemoMode()) return;
        if(confirm('Delete supplier?')) {
            try { await deleteDoc(doc(db, 'suppliers', id)); showMessage('Supplier deleted', 'success'); }
            catch(err) { showMessage(err.message, 'error'); }
        }
    };
}


// --- 8. USERS CRUD ---
function setupUsers() {
    const tbody = document.getElementById('users-table-body');
    let usersCache = [];

    onSnapshot(collection(db, 'users'), (snapshot) => {
        usersCache = [];
        let html = '';
        snapshot.forEach(doc => {
            const u = { id: doc.id, ...doc.data() };
            usersCache.push(u);
            html += `
                <tr class="border-b border-border hover:bg-card-header/50">
                    <td class="p-4 font-semibold">${u.email}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded text-xs ${u.role === 'Admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}">${u.role === 'Admin' ? 'Admin' : u.role}</span></td>
                    <td class="p-4 text-text-secondary">${u.fullName || '-'}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="openEditUserModal('${u.id}')" class="text-blue-400 hover:text-white"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="deleteUser('${u.id}')" class="text-red-400 hover:text-white"><i data-feather="trash" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
        feather.replace();
    });
    // If demo mode is enabled, we will not subscribe to Firestore here — demo data will be rendered instead
    if (IS_DEMO_MODE) {
        // no-op
    }

    // ADD USER (Requires Firebase Auth + Firestore)
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (checkDemoMode()) {
            try { e.target.reset(); } catch (er) {}
            return;
        }
        const form = e.target;
        const emailVal = (form.email && form.email.value || '').trim();
        if (!validateEmail(emailVal)) return showMessage('Please enter a valid email (must include @)', 'error');
        try {
            // Note: In a real app, creating another user usually requires a Cloud Function 
            // or a secondary Admin SDK connection because signed-in users can't create OTHER auth users easily.
            // For this demo, we will just add to Firestore collection to simulate the record.
            await addDoc(collection(db, 'users'), {
                fullName: form.fullName.value,
                email: emailVal,
                role: form.role.value,
                createdAt: serverTimestamp()
            });
            showMessage('User record added (Auth creation requires Admin SDK)', 'success');
            form.reset();
        } catch (err) { showMessage(err.message, 'error'); }
    });

    // UPDATE USER
    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        try {
            await updateDoc(doc(db, 'users', id), {
                fullName: document.getElementById('edit-user-fullname').value,
                role: document.getElementById('edit-user-role').value
            });
            showMessage('User updated', 'success');
            closeModal(document.getElementById('edit-user-modal'));
        } catch (err) { showMessage(err.message, 'error'); }
    });

    window.openEditUserModal = (id) => {
        const u = usersCache.find(i => i.id === id);
        if(u) {
            document.getElementById('edit-user-id').value = u.id;
            document.getElementById('edit-user-fullname').value = u.fullName;
            document.getElementById('edit-user-role').value = u.role;
            openModal(document.getElementById('edit-user-modal'));
        }
    };

    window.deleteUser = async (id) => {
        if (checkDemoMode()) return;
        if(confirm('Delete user record?')) {
            try { await deleteDoc(doc(db, 'users', id)); showMessage('User deleted', 'success'); }
            catch(err) { showMessage(err.message, 'error'); }
        }
    };
}


// --- 9. TRANSACTIONS (Item In, Item Out, Recent) ---
function setupTransactions() {
    const recentBody = document.getElementById('recent-fulfillment-table-body');
    const inBody = document.getElementById('item-in-transactions-table-body');
    const outBody = document.getElementById('item-out-transactions-table-body');

    // 1. Handle Stock In
    document.getElementById('add-stock-in-form').addEventListener('submit', (e) => handleTransaction(e, 'in'));
    
    // 2. Handle Stock Out
    document.getElementById('add-stock-out-form').addEventListener('submit', (e) => handleTransaction(e, 'out'));

    // 3. Listen to Transactions
    if (!IS_DEMO_MODE) {
        onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
            let recentHtml = '';
            let inHtml = '';
            let outHtml = '';

            snapshot.forEach(doc => {
                const t = { id: doc.id, ...doc.data() };
                const dateStr = t.date ? t.date.toDate().toLocaleDateString() : 'Just now';
                
                // Include reason (if present) below the item name for out transactions
                const reasonHtml = t.reason ? `<div class="text-xs text-text-faded mt-1">Reason: ${t.reason}</div>` : '';

                // Common Row HTML
                const row = `
                    <tr class="border-b border-border hover:bg-card-header/50">
                        ${t.type ? `<td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${t.type==='in'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}">${t.type.toUpperCase()}</span></td>` : ''}
                        <td class="p-4">${t.itemName}${reasonHtml}</td>
                        <td class="p-4 font-mono">${t.qty}</td>
                        <td class="p-4 text-sm text-text-secondary">${dateStr}</td>
                        <td class="p-4">
                             <button onclick="deleteTransaction('${t.id}', '${t.itemId}', ${t.qty}, '${t.type}')" class="text-red-400 hover:text-white text-xs border border-red-400/30 px-2 py-1 rounded">Delete</button>
                        </td>
                    </tr>
                `;

                if(recentHtml.length < 2000) recentHtml += row; // Limit recent view
                if(t.type === 'in') inHtml += row.replace(t.type ? /<td.*?>.*?<\/td>/ : '', ''); // Remove type col for specific tables
                if(t.type === 'out') outHtml += row.replace(t.type ? /<td.*?>.*?<\/td>/ : '', '');
            });

            recentBody.innerHTML = recentHtml;
            inBody.innerHTML = inHtml;
            outBody.innerHTML = outHtml;
        });
    }
}

// Transaction Handler (Add)
async function handleTransaction(e, type) {
    e.preventDefault();
    const form = e.target;
    // Demo mode: prevent stock in/out writes
    if (checkDemoMode()) {
        try { form.reset(); } catch (er) {}
        return;
    }
    const itemId = type === 'in' ? document.getElementById('stock-in-item').value : document.getElementById('stock-out-item').value;
    const qty = Number(type === 'in' ? document.getElementById('stock-in-qty').value : document.getElementById('stock-out-qty').value);
    if (type === 'out') {
        const reasonVal = (document.getElementById('stock-out-reason') && document.getElementById('stock-out-reason').value || '').trim();
        if (!reasonVal) return showMessage('Please provide a reason for stock out', 'error');
    }
    
    const item = allItems.find(i => i.id === itemId);
    if(!item) return showMessage('Item not found', 'error');

    try {
        await runTransaction(db, async (transaction) => {
            const itemRef = doc(db, 'items', itemId);
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) throw "Item does not exist!";
            
            const currentStock = itemDoc.data().stock || 0;
            const newStock = type === 'in' ? currentStock + qty : currentStock - qty;

            if (newStock < 0) throw "Insufficient stock!";

            transaction.update(itemRef, { stock: newStock });
            // include reason for 'out' transactions when provided
            const txnData = {
                itemId,
                itemName: item.name,
                type,
                qty,
                date: serverTimestamp()
            };
            if (type === 'out') {
                const reason = (document.getElementById('stock-out-reason') && document.getElementById('stock-out-reason').value || '').trim();
                txnData.reason = reason || null;
            }
            transaction.set(doc(collection(db, 'transactions')), txnData);
        });
        showMessage(`Stock ${type} recorded`, 'success');
        form.reset();
    } catch (err) {
        showMessage(err.message || err, 'error');
    }
}

// Transaction Delete (Reverse Logic)
window.deleteTransaction = async (tId, itemId, qty, type) => {
    if(!confirm('Delete this transaction? Stock will be reversed.')) return;

    try {
        await runTransaction(db, async (transaction) => {
            const itemRef = doc(db, 'items', itemId);
            const itemDoc = await transaction.get(itemRef);
            
            // If item still exists, reverse stock
            if (itemDoc.exists()) {
                const currentStock = itemDoc.data().stock;
                // Logic: If we delete an "IN", we must SUBTRACT stock. If we delete an "OUT", we must ADD stock.
                const reverseStock = type === 'in' ? currentStock - qty : currentStock + qty;
                
                if(reverseStock < 0) throw "Cannot reverse: Stock would become negative.";
                transaction.update(itemRef, { stock: reverseStock });
            }

            transaction.delete(doc(db, 'transactions', tId));
        });
        showMessage('Transaction deleted & stock reversed', 'success');
    } catch (err) {
        showMessage(err.message || err, 'error');
    }
};

// --- 10. Modal Utilities ---
document.getElementById('open-add-item-modal-btn').addEventListener('click', () => {
    openModal(document.getElementById('add-item-modal'));
});

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => closeModal(e.target.closest('.fixed')));
});

function openModal(el) { el.classList.remove('hidden'); }
function closeModal(el) { el.classList.add('hidden'); }

function showMessage(msg, type) {
    const box = document.getElementById('message-box');
    const text = document.getElementById('message-text');
    text.textContent = msg;
    box.className = `fixed bottom-6 right-6 p-4 rounded-lg text-white max-w-sm z-50 shadow-lg transition-all duration-300 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
    box.classList.remove('hidden', 'opacity-0', 'translate-y-10');
    setTimeout(() => box.classList.add('opacity-0', 'translate-y-10'), 3000);
    setTimeout(() => box.classList.add('hidden'), 3300);
}

// Demo mode helper: shows an alert and prevents writes when enabled
function checkDemoMode() {
    if (!IS_DEMO_MODE) return false;
    try {
        alert("This is a demo version. Database modifications are disabled.");
    } catch (e) {
        console.warn('Demo mode alert failed', e);
    }
    return true;
}

// Show a visible demo banner at the top of the page
function showDemoBanner() {
    if (!IS_DEMO_MODE) return;
    try {
        if (document.getElementById('demo-banner')) return; // already present
        const banner = document.createElement('div');
        banner.id = 'demo-banner';
        banner.style.position = 'fixed';
        banner.style.top = '12px';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.zIndex = '9999';
        banner.style.background = 'linear-gradient(90deg, rgba(245,158,11,0.95), rgba(234,88,12,0.95))';
        banner.style.color = '#000';
        banner.style.padding = '8px 14px';
        banner.style.borderRadius = '999px';
        banner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
        banner.style.fontWeight = '600';
        banner.style.fontSize = '13px';
        banner.textContent = 'Demo Mode — Database modifications are disabled.';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.marginLeft = '12px';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '16px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => banner.remove();
        banner.appendChild(closeBtn);

        document.body.appendChild(banner);
    } catch (e) { console.warn('Failed to show demo banner', e); }
}

// --- Demo Data Loader ---
function loadDemoData() {
    // Demo items
    const demoItems = [
        { id: 'itm1', name: 'Gaming Mouse', sku: 'GM-001', category: 'Peripherals', stock: 25, price: 1499.99 },
        { id: 'itm2', name: 'Mechanical Keyboard', sku: 'MK-101', category: 'Peripherals', stock: 12, price: 3499.50 },
        { id: 'itm3', name: '24in Monitor', sku: 'MN-240', category: 'Displays', stock: 7, price: 8999.00 }
    ];

    // Demo suppliers
    const demoSuppliers = [
        { id: 'sup1', name: 'TechDistro Inc', contact: 'Alice Mercado', phone: '+63 9123456789' },
        { id: 'sup2', name: 'Global Electronics', contact: 'Rodrigo Santos', phone: '+1 555-1234' }
    ];

    // Demo users
    const demoUsers = [
        { id: 'usr1', email: 'admin@example.com', role: 'Admin', fullName: 'Admin User' },
        { id: 'usr2', email: 'staff@example.com', role: 'Staff', fullName: 'Warehouse Staff' }
    ];

    // Populate items table
    const itemsTbody = document.getElementById('items-table-body');
    if (itemsTbody) {
        let html = '';
        demoItems.forEach(item => {
            html += `
                <tr class="border-b border-border hover:bg-card-header/50">
                    <td class="p-4 font-semibold">${item.name}</td>
                    <td class="p-4 text-text-secondary">${item.sku || '-'}</td>
                    <td class="p-4">${item.category || '-'}</td>
                    <td class="p-4 ${item.stock < 10 ? 'text-red-400 font-bold' : 'text-green-400'}">${item.stock}</td>
                    <td class="p-4">₱${Number(item.price).toFixed(2)}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="openEditItemModal('${item.id}')" class="text-blue-400 hover:text-white"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="deleteItem('${item.id}')" class="text-red-400 hover:text-white"><i data-feather="trash" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
        });
        itemsTbody.innerHTML = html;
        feather.replace();

        // Update dropdowns
        allItems = demoItems;
        const itemSelects = [document.getElementById('stock-in-item'), document.getElementById('stock-out-item')];
        const options = '<option value="">Select Item...</option>' + allItems.map(i => `<option value="${i.id}">${i.name} (Stock: ${i.stock})</option>`).join('');
        itemSelects.forEach(s => { if (s) s.innerHTML = options; });
    }

    // Populate suppliers table
    const suppliersTbody = document.getElementById('suppliers-table-body');
    if (suppliersTbody) {
        let html = '';
        demoSuppliers.forEach(s => {
            html += `
                <tr class="border-b border-border hover:bg-card-header/50">
                    <td class="p-4 font-semibold">${s.name}</td>
                    <td class="p-4 text-text-secondary">${s.contact || '-'}</td>
                    <td class="p-4">${s.phone || '-'}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="openEditSupplierModal('${s.id}')" class="text-blue-400 hover:text-white"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="deleteSupplier('${s.id}')" class="text-red-400 hover:text-white"><i data-feather="trash" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
        });
        suppliersTbody.innerHTML = html;
        feather.replace();
    }

    // Populate users table
    const usersTbody = document.getElementById('users-table-body');
    if (usersTbody) {
        let html = '';
        demoUsers.forEach(u => {
            html += `
                <tr class="border-b border-border hover:bg-card-header/50">
                    <td class="p-4 font-semibold">${u.email}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded text-xs ${u.role === 'Admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}">${u.role}</span></td>
                    <td class="p-4 text-text-secondary">${u.fullName || '-'}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="openEditUserModal('${u.id}')" class="text-blue-400 hover:text-white"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="deleteUser('${u.id}')" class="text-red-400 hover:text-white"><i data-feather="trash" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
        });
        usersTbody.innerHTML = html;
        feather.replace();
    }

    // Demo transactions
    const demoTransactions = [
        { id: 'tx1', itemId: 'itm1', itemName: 'Gaming Mouse', type: 'in', qty: 10, date: new Date(Date.now() - 86400000) },
        { id: 'tx2', itemId: 'itm2', itemName: 'Mechanical Keyboard', type: 'out', qty: 2, date: new Date(Date.now() - 3600000) },
        { id: 'tx3', itemId: 'itm3', itemName: '24in Monitor', type: 'in', qty: 5, date: new Date() }
    ];

    // Render transactions into recent, in, out tables
    const recentBody = document.getElementById('recent-fulfillment-table-body');
    const inBody = document.getElementById('item-in-transactions-table-body');
    const outBody = document.getElementById('item-out-transactions-table-body');
    if (recentBody) {
        let recentHtml = '';
        let inHtml = '';
        let outHtml = '';
        demoTransactions.forEach(t => {
            const dateStr = t.date ? t.date.toLocaleDateString() : 'Just now';
            const reasonHtml = t.reason ? `<div class="text-xs text-text-faded mt-1">Reason: ${t.reason}</div>` : '';
            const row = `
                <tr class="border-b border-border hover:bg-card-header/50">
                    ${t.type ? `<td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${t.type==='in'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}">${t.type.toUpperCase()}</span></td>` : ''}
                    <td class="p-4">${t.itemName}${reasonHtml}</td>
                    <td class="p-4 font-mono">${t.qty}</td>
                    <td class="p-4 text-sm text-text-secondary">${dateStr}</td>
                    <td class="p-4">
                         <button onclick="deleteTransaction('${t.id}', '${t.itemId}', ${t.qty}, '${t.type}')" class="text-red-400 hover:text-white text-xs border border-red-400/30 px-2 py-1 rounded">Delete</button>
                    </td>
                </tr>
            `;
            recentHtml += row;
            if (t.type === 'in') inHtml += row.replace(t.type ? /<td.*?>.*?<\/td>/ : '', '');
            if (t.type === 'out') outHtml += row.replace(t.type ? /<td.*?>.*?<\/td>/ : '', '');
        });
        recentBody.innerHTML = recentHtml;
        if (inBody) inBody.innerHTML = inHtml;
        if (outBody) outBody.innerHTML = outHtml;
    }
}

// Prefill login inputs and load demo data on page load when in demo mode
window.addEventListener('load', () => {
    try {
        if (IS_DEMO_MODE) {
            const loginEmail = document.getElementById('login-email');
            const loginPassword = document.getElementById('login-password');
            if (loginEmail) {
                loginEmail.value = 'Demo User';
                loginEmail.placeholder = 'Demo Mode';
                // Allow clicking Sign In without filling fields
                try { loginEmail.removeAttribute('required'); } catch (e) {}
            }
            if (loginPassword) {
                loginPassword.value = 'demo123';
                loginPassword.placeholder = 'Demo Mode';
                try { loginPassword.removeAttribute('required'); } catch (e) {}
            }

            // Disable native HTML5 validation for the login form so empty fields won't block submit
            try { const lf = document.getElementById('login-form'); if (lf) lf.noValidate = true; } catch (e) {}

            // Load demo data into tables
            loadDemoData();
            // Show demo banner
            showDemoBanner();
        }
    } catch (e) {
        console.warn('Demo load handler failed', e);
    }
});