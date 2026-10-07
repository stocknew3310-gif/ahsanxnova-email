// ============================================================
// AHSAN x NOVA — Temp Mail Service
// Firebase Auth + Firestore + Vercel Serverless Proxy
// ============================================================

import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ============================================================
// FIREBASE INIT
// ============================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// MAIL API — Vercel serverless proxy
// ============================================================
async function mailFetch(params) {
  const url = '/api/mail?' + params;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Proxy ' + res.status + ': ' + errText);
  }
  return res.json();
}

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let mailboxes = [];
let activeMailbox = null;
let inboxInterval = null;
let pollInterval = null;
let pendingDeleteId = null;

const $ = (id) => document.getElementById(id);

function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast ' + type; }, 3000);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function openModal(id) {
  $(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(id).classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
// AUTH TABS
// ============================================================
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    $(target + 'Form').classList.add('active');
  });
});

// ============================================================
// SIGN UP
// ============================================================
$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('signupEmail').value.trim();
  const pass = $('signupPassword').value;
  const confirm = $('signupConfirm').value;

  if (pass !== confirm) return toast('Passwords do not match', 'error');
  if (pass.length < 6) return toast('Password must be 6+ characters', 'error');

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Creating...';

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    toast('Account created!', 'success');
  } catch (err) {
    toast(parseError(err.code), 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create Account';
  }
});

// ============================================================
// SIGN IN
// ============================================================
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const pass = $('loginPassword').value;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in...';

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    toast('Welcome back!', 'success');
  } catch (err) {
    toast(parseError(err.code), 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
});

// ============================================================
// FORGOT PASSWORD
// ============================================================
$('forgotBtn').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  if (!email) return toast('Pehle email daal', 'error');
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Reset link bhej diya', 'success');
  } catch (err) {
    toast(parseError(err.code), 'error');
  }
});

// ============================================================
// SIGN OUT
// ============================================================
$('logoutBtn').addEventListener('click', async () => {
  if (inboxInterval) clearInterval(inboxInterval);
  await signOut(auth);
  toast('Signed out');
});

// ============================================================
// AUTH STATE
// ============================================================
onAuthStateChanged(auth, async (user) => {
  $('loader').classList.add('hide');
  if (user) {
    currentUser = user;
    $('userEmail').textContent = user.email;
    showScreen('dashScreen');
    await loadMailboxes();

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      if (currentUser && mailboxes.length > 0) {
        mailboxes.forEach(m => checkUnread(m.id));
      }
    }, 15000);
  } else {
    currentUser = null;
    showScreen('authScreen');
    mailboxes = [];
    renderMailboxes();
    if (pollInterval) clearInterval(pollInterval);
  }
});

function parseError(code) {
  const map = {
    'auth/email-already-in-use': 'Ye email pehle se registered hai',
    'auth/invalid-email': 'Email sahi nahi hai',
    'auth/weak-password': 'Password kamzor hai (6+ chahiye)',
    'auth/user-not-found': 'User nahi mila',
    'auth/wrong-password': 'Password ghalat hai',
    'auth/invalid-credential': 'Email ya password ghalat hai',
    'auth/too-many-requests': 'Bohat zyada tries — thodi der baad',
    'auth/network-request-failed': 'Internet check kar',
    'auth/operation-not-allowed': 'Email/Password Firebase mein enable nahi',
  };
  return map[code] || 'Kuch masla hua — dobara try kar';
}

// ============================================================
// GEN TABS
// ============================================================
document.querySelectorAll('.gen-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.gen;
    document.querySelectorAll('.gen-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.gen-body').forEach(b => b.classList.remove('active'));
    $('gen' + (target === 'random' ? 'Random' : 'Custom')).classList.add('active');
  });
});

// ============================================================
// RANDOM MAIL
// ============================================================
$('genRandomBtn').addEventListener('click', async () => {
  const domains = ['1secmail.com', '1secmail.net', '1secmail.org'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const name = 'axn' + Math.random().toString(36).substring(2, 10);
  await createMailbox(`${name}@${domain}`);
});

// ============================================================
// CUSTOM MAIL
// ============================================================
$('genCustomBtn').addEventListener('click', async () => {
  const name = $('customName').value.trim().toLowerCase();
  const domain = $('domainSelect').value;

  if (!name) return toast('Naam daal pehle', 'error');
  if (!/^[a-z0-9._-]+$/.test(name)) return toast('Sirf a-z, 0-9, . _ - allowed', 'error');
  if (name.length < 3) return toast('Kam se kam 3 characters', 'error');

  await createMailbox(`${name}@${domain}`);
  $('customName').value = '';
});

// ============================================================
// CREATE MAILBOX
// ============================================================
async function createMailbox(address) {
  if (!currentUser) return;
  if (mailboxes.some(m => m.address === address)) return toast('Ye mailbox already exists', 'error');

  const [name, domain] = address.split('@');

  try {
    const ref = collection(db, 'users', currentUser.uid, 'mailboxes');
    const docRef = await addDoc(ref, { address, name, domain, createdAt: serverTimestamp() });

    mailboxes.unshift({ id: docRef.id, address, name, domain, unread: 0, lastCheck: Date.now() });
    renderMailboxes();
    toast('Mailbox created: ' + address, 'success');
  } catch (err) {
    toast('Save nahi hua — ' + err.message, 'error');
  }
}

// ============================================================
// LOAD MAILBOXES
// ============================================================
async function loadMailboxes() {
  if (!currentUser) return;
  try {
    const ref = collection(db, 'users', currentUser.uid, 'mailboxes');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    mailboxes = [];
    snap.forEach(d => {
      const data = d.data();
      mailboxes.push({
        id: d.id,
        address: data.address,
        name: data.name,
        domain: data.domain,
        unread: 0,
        lastCheck: Date.now()
      });
    });

    renderMailboxes();
    mailboxes.forEach(m => checkUnread(m.id));
  } catch (err) {
    console.error(err);
    toast('Mailboxes load nahi hue', 'error');
  }
}

// ============================================================
// RENDER MAILBOXES
// ============================================================
function renderMailboxes() {
  const box = $('mailboxes');
  const empty = $('emptyState');
  $('mailCount').textContent = mailboxes.length;

  if (mailboxes.length === 0) {
    box.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  box.innerHTML = mailboxes.map(m => `
    <div class="mail-item" data-id="${m.id}">
      <div class="mail-addr">${escapeHtml(m.address)}</div>
      <div class="mail-foot">
        <span class="mail-time">${timeAgo(m.lastCheck)}</span>
        <span class="mail-unread ${m.unread === 0 ? 'zero' : ''}">${m.unread}</span>
      </div>
    </div>
  `).join('');

  box.querySelectorAll('.mail-item').forEach(el => {
    el.addEventListener('click', () => openInbox(el.dataset.id));
  });
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ============================================================
// OPEN INBOX
// ============================================================
async function openInbox(id) {
  const mb = mailboxes.find(m => m.id === id);
  if (!mb) return;

  activeMailbox = mb;
  $('inboxAddress').textContent = mb.address;
  $('inboxList').innerHTML = '';
  $('inboxEmpty').style.display = 'block';

  openModal('inboxModal');
  await fetchInbox();

  if (inboxInterval) clearInterval(inboxInterval);
  inboxInterval = setInterval(fetchInbox, 8000);
}

// ============================================================
// FETCH INBOX
// ============================================================
async function fetchInbox() {
  if (!activeMailbox) return;

  try {
    const msgs = await mailFetch(
      `action=getMessages&login=${activeMailbox.name}&domain=${activeMailbox.domain}`
    );

    const list = $('inboxList');
    const empty = $('inboxEmpty');

    if (!Array.isArray(msgs) || msgs.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      updateUnread(activeMailbox.id, 0);
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = msgs.map(m => `
      <div class="inbox-item" data-id="${m.id}">
        <div class="inbox-from">${escapeHtml(m.from || 'unknown')}</div>
        <div class="inbox-subj">${escapeHtml(m.subject || '(no subject)')}</div>
        <div class="inbox-time">${escapeHtml(m.date || '')}</div>
      </div>
    `).join('');

    list.querySelectorAll('.inbox-item').forEach(el => {
      el.addEventListener('click', () => openMessage(el.dataset.id));
    });

    updateUnread(activeMailbox.id, msgs.length);

  } catch (err) {
    console.error('Inbox error:', err);
    toast('Inbox fetch fail: ' + err.message, 'error');
  }
}

function updateUnread(mailboxId, count) {
  const mb = mailboxes.find(m => m.id === mailboxId);
  if (!mb) return;
  mb.unread = count;
  mb.lastCheck = Date.now();
  renderMailboxes();
}

async function checkUnread(mailboxId) {
  const mb = mailboxes.find(m => m.id === mailboxId);
  if (!mb) return;
  try {
    const msgs = await mailFetch(`action=getMessages&login=${mb.name}&domain=${mb.domain}`);
    if (Array.isArray(msgs)) updateUnread(mailboxId, msgs.length);
  } catch (e) {}
}

// ============================================================
// OPEN MESSAGE
// ============================================================
async function openMessage(msgId) {
  if (!activeMailbox) return;
  try {
    const msg = await mailFetch(
      `action=readMessage&login=${activeMailbox.name}&domain=${activeMailbox.domain}&id=${msgId}`
    );

    $('msgSubject').textContent = msg.subject || '(no subject)';
    $('msgFrom').textContent = msg.from || 'unknown';
    $('msgDate').textContent = msg.date || '';

    const body = msg.htmlBody || msg.textBody || '(empty)';
    $('msgBody').innerHTML = body;

    openModal('msgModal');
  } catch (err) {
    toast('Message load nahi hua', 'error');
  }
}

// ============================================================
// REFRESH / COPY / DELETE
// ============================================================
$('refreshInbox').addEventListener('click', () => {
  fetchInbox();
  toast('Refreshed', 'success');
});

$('copyAddr').addEventListener('click', async () => {
  if (!activeMailbox) return;
  try {
    await navigator.clipboard.writeText(activeMailbox.address);
    toast('Copied: ' + activeMailbox.address, 'success');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = activeMailbox.address;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copied', 'success');
  }
});

$('deleteMailbox').addEventListener('click', () => {
  if (!activeMailbox) return;
  pendingDeleteId = activeMailbox.id;
  $('confirmTitle').textContent = 'Delete this mailbox?';
  $('confirmText').textContent = 'Address: ' + activeMailbox.address;
  openModal('confirmModal');
});

$('confirmNo').addEventListener('click', () => {
  closeModal('confirmModal');
  pendingDeleteId = null;
});

$('confirmYes').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  try {
    const ref = doc(db, 'users', currentUser.uid, 'mailboxes', pendingDeleteId);
    await deleteDoc(ref);
    mailboxes = mailboxes.filter(m => m.id !== pendingDeleteId);
    renderMailboxes();
    closeModal('confirmModal');
    closeModal('inboxModal');
    pendingDeleteId = null;
    if (inboxInterval) clearInterval(inboxInterval);
    activeMailbox = null;
    toast('Mailbox deleted', 'success');
  } catch (err) {
    toast('Delete fail: ' + err.message, 'error');
  }
});

$('closeInbox').addEventListener('click', () => {
  closeModal('inboxModal');
  if (inboxInterval) clearInterval(inboxInterval);
  activeMailbox = null;
});

$('closeMsg').addEventListener('click', () => {
  closeModal('msgModal');
});

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) {
      m.classList.remove('active');
      document.body.style.overflow = '';
      if (m.id === 'inboxModal') {
        if (inboxInterval) clearInterval(inboxInterval);
        activeMailbox = null;
      }
    }
  });
});

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}