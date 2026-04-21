let db = {};

let currentName = '';
let calendarDate = new Date();
let adminCalendarDate = new Date(); // 관리자 달력용 날짜 상태

// --- 다크 모드 (Dark Mode) ---
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    const toggleBtn = document.getElementById('darkModeToggle');
    if(toggleBtn) toggleBtn.innerText = '☀️';
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    document.getElementById('darkModeToggle').innerText = isDark ? '☀️' : '🌙';
}

// --- 다른 PC 연동 (Firebase 설정) ---
// 외부 PC와 데이터를 연동하려면 index.html의 <head> 태그 안에 아래 스크립트를 먼저 추가해야 합니다.
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>

const firebaseConfig = {
  apiKey: "AIzaSyCk6Db7zQSYJRzqmYSTErTHM30jaQjHzvg",
  authDomain: "leave-management-system-a0ced.firebaseapp.com",
  projectId: "leave-management-system-a0ced",
  storageBucket: "leave-management-system-a0ced.firebasestorage.app",
  messagingSenderId: "971115534504",
  appId: "1:971115534504:web:39071a39519d4c54808a9d",
  measurementId: "G-0HCCW5TGP8",
  databaseURL: "https://leave-management-system-a0ced-default-rtdb.firebaseio.com"
};

let database;

if (typeof firebase !== 'undefined') {
    // Firebase가 HTML에 추가되어 있는 경우 실시간 DB 연동
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
    
    database.ref('leaveAppDB').on('value', (snapshot) => {
        db = snapshot.val() || {};
        refreshUI();
    });
} else {
    // 로컬 DB 초기화 (데이터가 없으면 빈 객체 생성) - Firebase가 없을 때 임시 작동
    db = JSON.parse(localStorage.getItem('leaveAppDB')) || {};
}

function saveDB() {
    if (database) {
        database.ref('leaveAppDB').set(db);
    } else {
        localStorage.setItem('leaveAppDB', JSON.stringify(db));
        refreshUI();
    }
}

// 화면 전체 새로고침 (DB 변경 시 자동 호출)
function refreshUI() {
    const view = sessionStorage.getItem('currentView');
    if (view === 'admin') {
        showAdminView();
    } else if (view === 'user') {
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser && db[sessionUser]) {
            loginSuccess(sessionUser);
        } else {
            logout();
        }
    }
}

// 고유 ID 생성기
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 커스텀 모달 (Promise 기반 - alert, confirm, prompt 통합)
function openModal(message, type = 'alert') {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const msgEl = document.getElementById('modalMessage');
        const inputEl = document.getElementById('modalInput');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        msgEl.innerText = message;
        modal.style.display = 'flex';

        if (type === 'prompt') {
            inputEl.style.display = 'block';
            inputEl.value = '';
            setTimeout(() => inputEl.focus(), 10); // 표시된 후 포커스
        } else {
            inputEl.style.display = 'none';
        }

        if (type === 'alert') {
            cancelBtn.style.display = 'none';
        } else {
            cancelBtn.style.display = 'inline-block';
        }

        // 버튼 이벤트 덮어쓰기
        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(type === 'prompt' ? inputEl.value : true);
        };

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(null); // 취소 시 null 반환
        };

        // 배경 클릭 시 닫기
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(type === 'alert' ? true : null);
            }
        };
    });
}

// 기존 알림용 래퍼 함수
function showModal(message) {
    openModal(message, 'alert');
}

// 로그아웃
function logout() {
    sessionStorage.removeItem('currentView');
    sessionStorage.removeItem('currentUser');
    currentName = '';
    
    document.getElementById('info').style.display = 'none';
    document.getElementById('adminView').style.display = 'none';
    document.getElementById('registerView').style.display = 'none';
    
    document.getElementById('userView').style.display = 'block';
    document.getElementById('loginSection').style.display = 'block';
    
    document.getElementById('nameInput').value = '';
    document.getElementById('loginPasswordInput').value = '';
}

// 사용자 로그인 및 조회
function fetchUser() {
    const name = document.getElementById('nameInput').value.trim();
    const pwd = document.getElementById('loginPasswordInput').value.trim();
    if (!name) return showModal('이름을 입력하세요.');
    if (!pwd) return showModal('비밀번호를 입력하세요.');

    document.getElementById('info').style.display = 'none';
    document.getElementById('registerView').style.display = 'none';

    if (!db[name]) {
        // 미등록 사용자
        currentName = name;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('newUserName').innerText = currentName;
        document.getElementById('registerPasswordInput').value = pwd;
        document.getElementById('registerView').style.display = 'block';
    } else {
        // 기존 사용자 검증
        const userPwd = db[name].password;
        if (!userPwd) {
            // 기존 사용자가 비밀번호가 없을 경우 자동 설정 (마이그레이션)
            db[name].password = pwd;
            saveDB();
        } else if (userPwd !== pwd) {
            return showModal('비밀번호가 일치하지 않습니다.');
        }
        
        loginSuccess(name);
    }
}

function loginSuccess(name) {
    currentName = name;
    sessionStorage.setItem('currentView', 'user');
    sessionStorage.setItem('currentUser', name);
    
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerView').style.display = 'none';
    document.getElementById('loggedInUserName').innerText = currentName;
    
    document.getElementById('userView').style.display = 'block';
    document.getElementById('adminView').style.display = 'none';
    
    updateUI();
}

// 신규 사용자 등록
function registerUser() {
    const initialLeave = parseFloat(document.getElementById('initialLeaveInput').value);
    const pwd = document.getElementById('registerPasswordInput').value;
    if (isNaN(initialLeave) || initialLeave < 0) {
        return showModal('유효한 연차 개수를 입력하세요.');
    }

    db[currentName] = { password: pwd, total: initialLeave, used: 0, history: [] };
    saveDB();
    
    showModal(`${currentName}님이 성공적으로 등록되었습니다.`);
    loginSuccess(currentName);
}

// 사용자 본인 비밀번호 변경
async function changeMyPassword() {
    if (!currentName || !db[currentName]) return;

    const currentPwd = await openModal('현재 비밀번호를 입력하세요:', 'prompt');
    if (currentPwd === null) return;

    if (currentPwd !== db[currentName].password) {
        return showModal('현재 비밀번호가 일치하지 않습니다.');
    }

    const newPwd = await openModal('새로운 비밀번호를 입력하세요:', 'prompt');
    if (newPwd === null) return;

    if (newPwd.trim() === '') {
        return showModal('비밀번호는 공백일 수 없습니다.');
    }

    db[currentName].password = newPwd.trim();
    saveDB();
    showModal('비밀번호가 성공적으로 변경되었습니다.');
}

// 여러 날짜 신청 토글
function toggleRangeInput() {
    const isRange = document.getElementById('isRange').checked;
    document.getElementById('endDate').style.display = isRange ? 'block' : 'none';
    document.getElementById('rangeTilde').style.display = isRange ? 'block' : 'none';
    
    const typeSelect = document.getElementById('type');
    if (isRange) {
        typeSelect.value = "1";
        typeSelect.disabled = true; // 기간 신청은 '연차'만 가능
    } else {
        typeSelect.disabled = false;
    }
}

// 연차 신청
function applyLeave() {
    const isRange = document.getElementById('isRange').checked;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const typeValue = document.getElementById('type').value;
    
    const user = db[currentName];
    if (!user.history) user.history = []; // Firebase 빈 배열 삭제 대응

    let datesToApply = [];
    let deductionPerDay = 1;
    let subType = typeValue; 
    let typeNum = typeValue.startsWith('0.5') ? 0.5 : 1;

    if (!isRange) {
        if (!startDate) return showModal('날짜를 선택하세요.');
        datesToApply.push(startDate);
        deductionPerDay = typeNum;
    } else {
        if (!startDate || !endDate) return showModal('시작일과 종료일을 모두 선택하세요.');
        if (startDate > endDate) return showModal('종료일이 시작일보다 앞설 수 없습니다.');
        
        let curr = new Date(startDate);
        let end = new Date(endDate);
        while (curr <= end) {
            // 주말(토=6, 일=0) 제외
            if (curr.getDay() !== 0 && curr.getDay() !== 6) {
                const dStr = `${curr.getFullYear()}-${String(curr.getMonth()+1).padStart(2,'0')}-${String(curr.getDate()).padStart(2,'0')}`;
                datesToApply.push(dStr);
            }
            curr.setDate(curr.getDate() + 1);
        }
        if (datesToApply.length === 0) return showModal('선택한 기간 내에 신청 가능한 평일이 없습니다.');
        deductionPerDay = 1; 
        subType = '1';
    }

    const totalDeduction = datesToApply.length * deductionPerDay;
    if (user.total - user.used < totalDeduction) {
        return showModal(`잔여 연차가 부족합니다. (필요: ${totalDeduction}일)`);
    }

    for (let d of datesToApply) {
        if (user.history.some(h => h.date === d && h.status !== 'rejected')) {
            return showModal(`${d}에는 이미 신청한 기록이 있습니다.`);
        }
    }

    for (let d of datesToApply) {
        let peopleOnLeave = 0;
        for (let p in db) {
            if (db[p].history && db[p].history.some(h => h.date === d && h.status !== 'rejected')) {
                peopleOnLeave++;
            }
        }
        if (peopleOnLeave >= 2) {
            return showModal(`${d}에는 이미 2명이 신청하여 더 이상 신청할 수 없습니다.`);
        }
    }

    datesToApply.forEach(d => {
        user.used += deductionPerDay;
        user.history.push({ id: generateId(), date: d, type: deductionPerDay, subType: subType, status: 'pending' });
    });
    saveDB();
    
    if (isRange && datesToApply.length > 1) {
        showModal(`${datesToApply.length}일의 연차가 신청되었습니다. (주말 자동 제외됨)`);
    }
}

// 연차 취소(삭제)
async function deleteLeave(leaveId) {
    const confirmed = await openModal('이 기록을 삭제하시겠습니까?', 'confirm');
    if (!confirmed) return;

    const user = db[currentName];
    if (!user.history) user.history = []; // Firebase 빈 배열 삭제 대응
    const recordIndex = user.history.findIndex(h => h.id === leaveId);
    
    if (recordIndex > -1) {
        const record = user.history[recordIndex];
        if (record.status !== 'rejected') {
            user.used -= record.type; // 반려 상태가 아니라면 차감된 연차 복구
        }
        user.history.splice(recordIndex, 1);
        saveDB();
    }
}

// 달력 날짜 클릭 시 인풋에 값 넣기
function selectDateFromCalendar(dateString) {
    document.getElementById('startDate').value = dateString;
}

// 화면 업데이트 로직
function updateUI() {
    const user = db[currentName];
    if (!user.history) user.history = []; // Firebase 데이터 불러올 때 배열 초기화

    // 승인/반려 알림 처리
    let needsSave = false;
    let combinedMsg = ''; // 여러 알림이 있을 경우를 위해 합침
    user.history.forEach(h => {
        if ((h.status === 'approved' || h.status === 'rejected') && !h.notified) {
            const statusMsg = h.status === 'approved' ? '승인' : '반려';
            const typeStr = h.type == 1 ? '연차' : (h.subType === '0.5pm' ? '오후 반차' : (h.subType === '0.5am' ? '오전 반차' : '반차'));
            combinedMsg += `[알림] ${h.date} (${typeStr}) 신청이 ${statusMsg}되었습니다.\n`;
            if (h.reason) {
                combinedMsg += `사유: ${h.reason}\n`;
            }
            combinedMsg += '\n';
            h.notified = true;
            needsSave = true;
        }
    });
    if (combinedMsg) {
        showModal(combinedMsg.trim());
    }
    if (needsSave) {
        saveDB(); // 알림 확인 상태를 DB에 저장
    }

    document.getElementById('info').style.display = 'block';
    document.getElementById('remain').innerText = (user.total - user.used).toFixed(1);
    document.getElementById('used').innerText = user.used.toFixed(1);
    
    // 내역 렌더링
    const historyContainer = document.getElementById('history');
    historyContainer.innerHTML = '<h4>신청 기록</h4>';
    
    if (user.history.length === 0) {
        historyContainer.innerHTML += '<p style="color:#666;">기록이 없습니다.</p>';
    } else {
        // 최신순으로 정렬해서 보여주기 위해 slice().reverse() 사용
        user.history.slice().reverse().forEach(h => {
            let statusText = '승인 완료';
            let statusColor = 'green';
            
            if (h.status === 'pending') {
                statusText = '승인 대기';
                statusColor = 'orange';
            } else if (h.status === 'rejected') {
                statusText = '반려됨';
                statusColor = 'red';
            } else if (h.status === 'approved') {
                statusText = '승인 완료';
                statusColor = 'green';
            }

            const item = document.createElement('div');
            item.className = 'history-item';
            item.style.alignItems = 'flex-start'; // 사유가 추가되어 여러 줄이 될 수 있으므로 위쪽 정렬
            const typeStr = h.type == 1 ? '연차' : (h.subType === '0.5pm' ? '오후 반차' : (h.subType === '0.5am' ? '오전 반차' : '반차'));
            item.innerHTML = `
                <div>
                    <span>${h.date} - <strong>${typeStr}</strong> 
                    <span style="color:${statusColor}; font-size: 0.8em; margin-left: 5px;">[${statusText}]</span></span>
                    ${h.reason ? `<div style="font-size: 0.85em; color: #666; margin-top: 5px;">사유: ${h.reason}</div>` : ''}
                </div>
                <button class="delete-btn" onclick="deleteLeave('${h.id}')">삭제</button>
            `;
            historyContainer.appendChild(item);
        });
    }
    
    // 달력 렌더링
    renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth(), user.history);
}

// 화면 전환: 관리자 (전체 인원 불러오기)
async function showAdminView() {
    if (sessionStorage.getItem('currentView') !== 'admin') {
        const pwd = await openModal('관리자 비밀번호를 입력하세요:\n(초기 비밀번호: admin1234)', 'prompt');
        if (pwd === null) return; // '취소' 클릭 시
        if (pwd !== 'admin1234') {
            return showModal('관리자 비밀번호가 틀렸습니다.');
        }
    }
    
    sessionStorage.setItem('currentView', 'admin');
    document.getElementById('userView').style.display = 'none';
    document.getElementById('adminView').style.display = 'block';
    
    const userListContainer = document.getElementById('userList');
    userListContainer.innerHTML = '<h3>팀원 연차 현황</h3>';

    const users = Object.keys(db);
    if (users.length === 0) {
        userListContainer.innerHTML = '<p style="text-align:center; color:#666;">등록된 팀원이 없습니다.</p>';
        return;
    }

    users.forEach(name => {
        const u = db[name];
        const item = document.createElement('div');
        item.className = 'user-list-item';
        item.style.alignItems = 'center'; // 버튼과 텍스트 수직 중앙 정렬
        item.innerHTML = `
            <div>
                <strong>${name}</strong>
                <span style="margin-left: 10px; font-size: 0.9em; color: #666;">남은 연차: <strong style="color: var(--primary-color);">${(u.total - u.used).toFixed(1)}일</strong></span>
            </div>
            <div>
                <button onclick="resetUserPassword('${name}')" style="width: auto; padding: 5px 10px; margin: 0 5px 0 0; background: var(--danger-color); font-size: 12px; border-radius: 6px;">비번 초기화</button>
                <button onclick="deleteUserAccount('${name}')" style="width: auto; padding: 5px 10px; margin: 0; background: #6b7280; font-size: 12px; border-radius: 6px;">계정 삭제</button>
            </div>
        `;
        userListContainer.appendChild(item);
    });

    // 승인 대기 목록 렌더링
    const pendingContainer = document.createElement('div');
    const pendingHeader = document.createElement('div');
    pendingHeader.style.display = 'flex';
    pendingHeader.style.justifyContent = 'space-between';
    pendingHeader.style.alignItems = 'center';
    pendingHeader.style.marginTop = '30px';
    pendingHeader.innerHTML = '<h3 style="margin: 0;">승인 대기 중인 신청</h3>';
    
    const pendingList = document.createElement('div');
    let hasPending = false;

    users.forEach(name => {
        const u = db[name];
        if (!u.history) return;
        
        u.history.forEach(h => {
            if (h.status === 'pending') {
                hasPending = true;
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.style.border = '1px solid #ddd';
                item.style.padding = '10px';
                item.style.marginTop = '10px';
                const typeStr = h.type == 1 ? '연차' : (h.subType === '0.5pm' ? '오후 반차' : (h.subType === '0.5am' ? '오전 반차' : '반차'));
                item.innerHTML = `
                    <div style="margin-bottom: 5px;"><strong>${name}</strong> - ${h.date} (${typeStr})</div>
                    <button onclick="approveLeave('${name}', '${h.id}')" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer;">승인</button>
                    <button onclick="rejectLeave('${name}', '${h.id}')" style="background: #f44336; color: white; border: none; padding: 5px 10px; cursor: pointer; margin-left: 5px;">반려</button>
                `;
                pendingList.appendChild(item);
            }
        });
    });

    if (!hasPending) {
        pendingList.innerHTML = '<p style="color:#666; margin-top: 10px;">대기 중인 신청이 없습니다.</p>';
    } else {
        pendingHeader.innerHTML += `<button onclick="approveAllLeaves()" style="width: auto; padding: 5px 12px; margin: 0; background: var(--secondary-color); font-size: 12px; border-radius: 6px;">모두 승인</button>`;
    }
    
    pendingContainer.appendChild(pendingHeader);
    pendingContainer.appendChild(pendingList);
    userListContainer.appendChild(pendingContainer);

    // 전체 팀원 달력 렌더링
    renderAdminCalendar(adminCalendarDate.getFullYear(), adminCalendarDate.getMonth());
}

// 관리자: 연차 승인
async function approveLeave(userName, leaveId) {
    const user = db[userName];
    if (!user || !user.history) return;
    const record = user.history.find(h => h.id === leaveId);
    if (record) {
        const reason = await openModal('승인 사유를 입력하세요 (선택사항, 입력하지 않아도 됩니다):', 'prompt');
        if (reason === null) return; // '취소' 클릭 시 진행 중단

        record.status = 'approved';
        if (reason.trim() !== '') record.reason = reason.trim(); // 사유가 있을 경우만 저장
        
        record.notified = false; // 사용자에게 알림을 띄우기 위해 상태 초기화
        saveDB();
    }
}

// 관리자: 모든 대기 건 일괄 승인
async function approveAllLeaves() {
    const confirmed = await openModal('모든 대기 중인 신청을 일괄 승인하시겠습니까?', 'confirm');
    if (!confirmed) return;

    const reason = await openModal('일괄 승인 사유를 입력하세요 (선택사항, 입력하지 않아도 됩니다):', 'prompt');
    if (reason === null) return; // '취소' 클릭 시 진행 중단

    let count = 0;
    for (let name in db) {
        if (db[name].history) {
            db[name].history.forEach(h => {
                if (h.status === 'pending') {
                    h.status = 'approved';
                    if (reason.trim() !== '') h.reason = reason.trim();
                    h.notified = false; // 사용자에게 알림 띄우기
                    count++;
                }
            });
        }
    }

    if (count > 0) {
        saveDB();
        showModal(`${count}건의 신청이 일괄 승인되었습니다.`);
        showAdminView(); // 목록 새로고침
    }
}

// 관리자: 연차 반려
async function rejectLeave(userName, leaveId) {
    const user = db[userName];
    if (!user || !user.history) return;
    const record = user.history.find(h => h.id === leaveId);
    if (record) {
        const reason = await openModal('반려 사유를 입력하세요 (선택사항, 입력하지 않아도 됩니다):', 'prompt');
        if (reason === null) return; // '취소' 클릭 시 진행 중단

        record.status = 'rejected';
        if (reason.trim() !== '') record.reason = reason.trim(); // 사유가 있을 경우만 저장
        
        record.notified = false; // 사용자에게 알림을 띄우기 위해 상태 초기화
        user.used -= record.type; // 반려 시 차감되었던 연차 복구
        saveDB();
    }
}

// 관리자: 사용자 비밀번호 초기화
async function resetUserPassword(userName) {
    const newPwd = await openModal(`${userName}님의 새 비밀번호를 입력하세요:`, 'prompt');
    if (newPwd === null) return; // '취소' 클릭 시
    
    if (newPwd.trim() === '') {
        return showModal('비밀번호는 공백일 수 없습니다.');
    }

    if (db[userName]) {
        db[userName].password = newPwd.trim();
        saveDB();
        showModal(`${userName}님의 비밀번호가 성공적으로 변경되었습니다.`);
    }
}

// 관리자: 사용자 계정 삭제 (퇴사자 처리)
async function deleteUserAccount(userName) {
    const confirmed = await openModal(`정말 ${userName}님의 계정과 모든 연차 기록을 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다!)`, 'confirm');
    if (!confirmed) return;

    if (db[userName]) {
        delete db[userName]; // 데이터베이스에서 사용자 완전히 삭제
        saveDB();
        showModal(`${userName}님의 계정이 성공적으로 삭제되었습니다.`);
        showAdminView(); // 목록 새로고침
    }
}

// 달력 이동
function changeMonth(offset) {
    calendarDate.setMonth(calendarDate.getMonth() + offset);
    if (currentName && db[currentName]) {
        renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth(), db[currentName].history || []);
    }
}

// 달력 그리기 로직
function renderCalendar(year, month, history) {
    history = history || []; // 배열이 없을 경우를 위한 방어 코드

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    document.getElementById('calendarTitle').innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 요일 헤더
    ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
        const dayNameEl = document.createElement('div');
        dayNameEl.className = 'calendar-day-name';
        dayNameEl.innerText = day;
        grid.appendChild(dayNameEl);
    });

    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerText = day;
        
        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        dayEl.onclick = () => {
            selectDateFromCalendar(currentDateStr);
            // 시각적 피드백
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
            dayEl.classList.add('selected');
        };

        // 해당 날짜에 연차 기록이 있는지 확인
        const leaveOnDay = history.find(h => h.date === currentDateStr && h.status !== 'rejected' && h.status !== 'canceled');
        if (leaveOnDay) {
            if (leaveOnDay.type == 1) {
                dayEl.classList.add('has-leave');
            } else if (leaveOnDay.subType === '0.5pm') {
                dayEl.classList.add('has-half-pm-leave');
            } else {
                dayEl.classList.add('has-half-am-leave');
            }
        }
        grid.appendChild(dayEl);
    }
}

// 관리자용 달력 이동
function changeAdminMonth(offset) {
    adminCalendarDate.setMonth(adminCalendarDate.getMonth() + offset);
    renderAdminCalendar(adminCalendarDate.getFullYear(), adminCalendarDate.getMonth());
}

// 관리자용 전체 팀원 달력 그리기
function renderAdminCalendar(year, month) {
    const grid = document.getElementById('adminCalendarGrid');
    grid.innerHTML = '';
    document.getElementById('adminCalendarTitle').innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 요일 헤더
    ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
        const dayNameEl = document.createElement('div');
        dayNameEl.className = 'admin-calendar-day-name';
        dayNameEl.innerText = day;
        grid.appendChild(dayNameEl);
    });

    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'admin-calendar-day';
        
        const dateSpan = document.createElement('span');
        dateSpan.innerText = day;
        dateSpan.style.marginBottom = '2px';
        dayEl.appendChild(dateSpan);
        
        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // 해당 날짜에 연차 기록이 있는 모든 사용자 찾기
        for (let name in db) {
            if (db[name].history) {
                const leave = db[name].history.find(h => h.date === currentDateStr && h.status !== 'rejected' && h.status !== 'canceled');
                if (leave) {
                    const tag = document.createElement('div');
                    let tagClass = 'full';
                    let tagText = name;
                    let typeLabel = '연차';
                    
                    if (leave.type == 0.5) {
                        if (leave.subType === '0.5pm') {
                            tagClass = 'half-pm'; tagText += '(오후)'; typeLabel = '오후 반차';
                        } else if (leave.subType === '0.5am') {
                            tagClass = 'half-am'; tagText += '(오전)'; typeLabel = '오전 반차';
                        } else {
                            tagClass = 'half-am'; tagText += '(반)'; typeLabel = '반차'; // 과거 데이터용
                        }
                    }
                    
                    tag.className = `admin-leave-tag ${tagClass} ${leave.status === 'pending' ? 'pending' : ''}`;
                    tag.innerText = tagText;
                    tag.title = `${name} - ${typeLabel} ${leave.status === 'pending' ? '(대기중)' : '(승인됨)'}`;
                    dayEl.appendChild(tag);
                }
            }
        }
        grid.appendChild(dayEl);
    }
}