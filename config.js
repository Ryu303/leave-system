// config.js
// ----------------------------------------------------
// 전역 변수 (Global Variables)
// ----------------------------------------------------
const ADMIN_UID = "jaGugunGReXytCgbqYwQUybxyJL2"; 
let currentUserProfile = null;
let globalTasksData = {};
let globalTripsData = {};
let globalLeavesData = {};
let globalUsersData = {};
let globalNoticesData = {};
let currentViewMode = 'status';
let currentDateForCalendar = new Date();
let currentDateForGantt = new Date();
let currentDateForModalCalendar = new Date();
let currentDateForMyPageCalendar = new Date();

// ----------------------------------------------------
// 유틸리티 (Utilities)
// ----------------------------------------------------
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const checkAuth = async (msg = '승인된 사용자만 이용할 수 있습니다.') => {
    if (!currentUserProfile || !currentUserProfile.approved) { await customAlert(msg); return false; }
    return true;
};

// ----------------------------------------------------
// Firebase 설정
// ----------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyBOIugED48GlLzHytc6p4XDbrJVzouA4Q8",
    authDomain: "coworking-tool.firebaseapp.com",
    projectId: "coworking-tool",
    storageBucket: "coworking-tool.firebasestorage.app",
    messagingSenderId: "614190014572",
    appId: "1:614190014572:web:ef61d476457cdc1ef27849",
    measurementId: "G-B4RSYQ38P8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db = firebase.database();
const storage = firebase.storage();

// ----------------------------------------------------
// 다크 모드 & 테마 & 달력 설정
// ----------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-toggle').innerHTML = savedTheme === 'dark' ? '<span class="material-symbols-rounded">light_mode</span>' : '<span class="material-symbols-rounded">dark_mode</span>';
    const flatpickrTheme = document.getElementById('flatpickr-theme');
    if (savedTheme === 'dark' && flatpickrTheme) {
        flatpickrTheme.href = "https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css";
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-toggle').innerHTML = newTheme === 'dark' ? '<span class="material-symbols-rounded">light_mode</span>' : '<span class="material-symbols-rounded">dark_mode</span>';
    const flatpickrTheme = document.getElementById('flatpickr-theme');
    if (flatpickrTheme) {
        flatpickrTheme.href = newTheme === 'dark' ? "https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css" : "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css";
    }
}

initTheme();

const fpConfig = {
    locale: "ko",
    dateFormat: "Y-m-d",
    disableMobile: true,
    monthSelectorType: "static"
};
flatpickr("#modalStartDate", fpConfig);
flatpickr("#modalDueDate", fpConfig);
flatpickr("#tripDate", fpConfig);
flatpickr("#leaveStartDate", fpConfig);
flatpickr("#leaveEndDate", fpConfig);
flatpickr("#mapStartDate", fpConfig);
flatpickr("#mapEndDate", fpConfig);

// ----------------------------------------------------
// 공통 알림 모달 & 토스트 알림
// ----------------------------------------------------
function customModalAction(type, message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('alertModal');
        const msgEl = document.getElementById('alertMessage');
        const inputEl = document.getElementById('alertInput');
        const confirmBtn = document.getElementById('alertConfirmBtn');
        const cancelBtn = document.getElementById('alertCancelBtn');

        msgEl.textContent = message;
        modal.style.display = 'flex';

        if (type === 'prompt') {
            inputEl.style.display = 'block';
            inputEl.value = defaultValue;
            setTimeout(() => inputEl.focus(), 10);
        } else {
            inputEl.style.display = 'none';
        }

        cancelBtn.style.display = type === 'alert' ? 'none' : 'block';
        cancelBtn.style.flex = '1';

        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(type === 'prompt' ? inputEl.value : true);
        };

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(type === 'prompt' ? null : false);
        };
    });
}
const customAlert = (msg) => customModalAction('alert', msg);
const customConfirm = (msg) => customModalAction('confirm', msg);
const customPrompt = (msg, def) => customModalAction('prompt', msg, def);

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    let iconColor = 'var(--primary)';
    if (type === 'warning') {
        icon = 'notifications_active';
        iconColor = '#F59E0B';
    }
    
    toast.innerHTML = `
        <span class="material-symbols-rounded" style="color: ${iconColor}; font-size: 1.8rem;">${icon}</span>
        <span style="font-size: 0.95rem; font-weight: 600; line-height: 1.5; white-space: pre-wrap;">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 5000);
}

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    if (element) element.classList.add('active');
    document.getElementById(tabId).style.display = 'block';
    
    // 탭 전환 시 화면을 강제로 최신화하여 즉각 반영 (F5 방지)
    if (tabId === 'tab-admin' && auth.currentUser && auth.currentUser.uid === ADMIN_UID) {
        if (typeof renderAdminLeaves === 'function') renderAdminLeaves();
    } else if (tabId === 'tab-leaves') {
        if (typeof renderLeaveUI === 'function') renderLeaveUI();
    } else if (tabId === 'tab-tasks') {
        if (typeof renderTasks === 'function') renderTasks();
    } else if (tabId === 'tab-mypage') {
        if (typeof renderMyPage === 'function') renderMyPage();
    }
}