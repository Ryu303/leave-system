// services.js
// ----------------------------------------------------
// 휴가 결재, 마이페이지, 공지사항 및 실시간 통신(채팅, 문서, 드라이브)
// ----------------------------------------------------
function toggleLeaveRange() {
    const isRange = document.getElementById('leaveIsRange').checked;
    document.getElementById('leaveEndDate').style.display = isRange ? 'block' : 'none';
    document.getElementById('leaveRangeTilde').style.display = isRange ? 'block' : 'none';
    document.getElementById('leaveType').disabled = isRange;
}

async function applyLeave() {
    if (!(await checkAuth('승인된 사용자만 신청할 수 있습니다.'))) return;
    const isRange = document.getElementById('leaveIsRange').checked;
    const start = document.getElementById('leaveStartDate').value, end = document.getElementById('leaveEndDate').value, typeVal = document.getElementById('leaveType').value;
    let dates = [], deduction = typeVal.startsWith('0.5') ? 0.5 : 1;
    
    if (!isRange) { 
        if (!start) return await customAlert('휴가 날짜를 선택해주세요.'); 
        dates.push(start); 
    } else {
        if (!start || !end) return await customAlert('시작일과 종료일을 모두 선택해주세요.');
        let curr = new Date(start), endD = new Date(end);
        if (curr > endD) return await customAlert('시작일이 종료일보다 늦을 수 없습니다.');
        while (curr <= endD) { 
            if (curr.getDay() !== 0 && curr.getDay() !== 6) dates.push(`${curr.getFullYear()}-${String(curr.getMonth()+1).padStart(2,'0')}-${String(curr.getDate()).padStart(2,'0')}`); 
            curr.setDate(curr.getDate() + 1); 
        }
    }

    if (dates.length === 0) return await customAlert('신청할 수 있는 유효한 날짜(평일)가 없습니다.');

    const btn = document.getElementById('applyLeaveBtn');
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = '신청 중...';

    try {
        await Promise.all(dates.map(d => { 
            const ref = db.ref('leaves').push(); 
            const currentUserProfile = AppStore.getCurrentUser();
            return ref.set({ id: ref.key, uid: auth.currentUser.uid, userName: currentUserProfile.displayName, date: d, type: deduction, subType: isRange ? '1' : typeVal, status: 'pending', timestamp: Date.now() }); 
        }));
        
        // 신청 즉시 입력창 초기화 및 토스트 알림 (체감 속도 대폭 향상)
        document.getElementById('leaveStartDate').value = '';
        document.getElementById('leaveEndDate').value = '';
        showToast('휴가가 성공적으로 신청되었습니다.', 'info');
    } catch (error) {
        await customAlert('신청 중 오류가 발생했습니다: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = originalText;
    }
}

function renderLeaveUI() {
    const currentUserProfile = AppStore.getCurrentUser();
    if (!auth.currentUser || !currentUserProfile) return;
    let used = 0; const myLeaves = Object.values(AppStore.getLeaves()).filter(l => l.uid === auth.currentUser.uid);
    myLeaves.forEach(l => { if (l.status === 'approved' || l.status === 'pending' || l.status === 'cancel_requested') used += l.type; });
    document.getElementById('leave-remain').textContent = ((currentUserProfile.leaveTotal || 15) - used).toFixed(1);
    document.getElementById('leave-used').textContent = used.toFixed(1);
    const listEl = document.getElementById('leave-history-list'); listEl.innerHTML = '';
    
    const now = Date.now();
    const todayTime = new Date().setHours(0,0,0,0);
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000; // 3일을 밀리초로 변환

    myLeaves.sort((a,b) => b.timestamp - a.timestamp).forEach(l => {
        // 3일이 지난 기록은 내역에서 자동으로 숨김 처리
        if (l.status === 'approved') {
            const leaveTime = new Date(l.date).setHours(0,0,0,0);
            if ((todayTime - leaveTime) >= threeDaysMs) return; // 휴가일 기준 3일 경과 시 숨김
        } else if (l.status === 'rejected' || l.status === 'canceled') {
            if ((now - l.timestamp) >= threeDaysMs) return; // 반려/취소는 신청일 기준 3일 경과 시 숨김
        }

        const li = document.createElement('li'); 
        let statusText = l.status === 'approved' ? '승인됨' : (l.status === 'pending' ? '승인 대기중' : (l.status === 'cancel_requested' ? '취소 대기중' : (l.status === 'rejected' ? '반려됨' : '취소됨')));
        let color = l.status === 'approved' ? '#10B981' : (l.status === 'rejected' || l.status === 'cancel_requested' ? 'var(--danger)' : '#F59E0B');
        let btnHtml = (l.status === 'pending' || l.status === 'approved') ? `<button class="delete-btn" onclick="cancelLeave('${l.id}')">취소</button>` : '';
        li.innerHTML = `<div><div style="font-weight:600;">${l.date}</div><div style="font-size:0.8rem; color:${color}">${statusText}</div></div>${btnHtml}`;
        listEl.appendChild(li);
    });
}

async function cancelLeave(id) { 
    if (await customConfirm('휴가를 취소하시겠습니까?\n\n※ 휴가 취소는 담당자에게 보고 후 등록해주세요.')) {
        const leave = AppStore.getLeaves()[id];
        if (!leave) return;
        
        // 1. 즉각적인 시각적 상호작용 (버튼 비활성화 및 텍스트 변경)
        const btn = document.querySelector(`button[onclick="cancelLeave('${id}')"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = '처리중...';
        }

        // 2. 비동기 처리 및 에러 핸들링
        try {
            if (leave.status === 'pending') {
                await db.ref('leaves/' + id).remove(); // 아직 승인 전이면 즉시 삭제
                showToast('휴가 신청이 취소되었습니다.', 'info');
            } else {
                await db.ref('leaves/' + id).update({ status: 'cancel_requested' }); // 승인되었으면 취소 결재 요청
                showToast('관리자에게 휴가 취소를 요청했습니다.', 'info');
            }
        } catch (error) {
            if (btn) { btn.disabled = false; btn.textContent = '취소'; }
            await customAlert('취소 처리 중 오류가 발생했습니다: ' + error.message);
        }
    } 
}
async function deleteLeaveRecord(id) { if (await customConfirm('삭제하시겠습니까?')) db.ref('leaves/' + id).remove(); }

function renderAdminLeaves() {
    const listEl = document.getElementById('admin-leave-list');
    if (listEl) {
        listEl.innerHTML = '';
        Object.keys(AppStore.getUsers()).forEach(uid => {
            const u = AppStore.getUsers()[uid];
            if (!u.approved) return;
            let used = 0;
            Object.values(AppStore.getLeaves()).forEach(l => {
                if (l.uid === uid && (l.status === 'approved' || l.status === 'pending' || l.status === 'cancel_requested')) used += l.type;
            });
            const total = u.leaveTotal || 15;
            const card = document.createElement('div');
            card.style.cssText = 'background-color: var(--card-bg); border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; box-shadow: var(--shadow-sm);';
            card.innerHTML = `<div style="font-weight: bold; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;"><span>${u.displayName}</span><button onclick="adminEditTotalLeave('${uid}', ${total})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background-color: var(--col-bg); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">수정</button></div><div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;"><span>총 연차:</span> <span>${total}일</span></div><div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;"><span>사용함:</span> <span style="color: var(--danger);">${used.toFixed(1)}일</span></div><div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 0.3rem; padding-top: 0.3rem; border-top: 1px dashed var(--border-color); font-weight: bold;"><span>잔여:</span> <span style="color: var(--primary);">${(total - used).toFixed(1)}일</span></div>`;
            listEl.appendChild(card);
        });
    }
    
    // 휴가 결재 대기 목록 렌더링 로직
    const pendingLeaves = Object.values(AppStore.getLeaves()).filter(l => l.status === 'pending' || l.status === 'cancel_requested');
    let pendingHTML = '';
    if (pendingLeaves.length === 0) {
        pendingHTML = '<li style="justify-content: center; color: var(--text-muted); font-size: 0.9rem; background-color: transparent; border: 1px dashed var(--border-color);">대기 중인 결재 건이 없습니다.</li>';
    } else {
        pendingHTML = pendingLeaves.sort((a, b) => b.timestamp - a.timestamp).map(l => {
            const typeText = l.type === 1 ? '연차(1일)' : (l.subType === '0.5am' ? '오전 반차' : '오후 반차');
            const isCancel = l.status === 'cancel_requested';
            return `<li style="background-color: var(--card-bg); box-shadow: var(--shadow-sm); border: 1px solid var(--border-color);">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="font-weight:600; display:flex; align-items:center; gap:6px;">
                        ${l.userName} <span style="font-size:0.8rem; padding:2px 6px; border-radius:4px; background-color:var(--bg-color); color:${isCancel ? 'var(--danger)' : 'var(--text-muted)'};">${isCancel ? '취소 요청' : typeText}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--primary); font-weight:bold;">${l.date}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button onclick="adminResolveLeave('${l.id}', 'approved', '${l.status}')" style="background-color: #10B981; padding: 0.4rem 0.8rem; font-size: 0.8rem;">승인</button>
                    <button onclick="adminResolveLeave('${l.id}', 'rejected', '${l.status}')" style="background-color: var(--danger); padding: 0.4rem 0.8rem; font-size: 0.8rem;">반려</button>
                </div>
            </li>`;
        }).join('');
    }
    
    const pendingListEl = document.getElementById('admin-pending-leaves-list');
    if (pendingListEl) pendingListEl.innerHTML = pendingHTML;
}

async function adminResolveLeave(id, newStatus, currentStatus) { 
    try {
        if (newStatus === 'rejected') {
            const reason = await customPrompt('반려 사유를 입력하세요:');
            if (reason === null) return;
            await db.ref('leaves/' + id).update({ status: currentStatus === 'cancel_requested' ? 'approved' : 'rejected', rejectReason: reason });
            showToast('반려 처리되었습니다.', 'info');
        } else {
            if (currentStatus === 'cancel_requested') {
                await db.ref('leaves/' + id).remove();
                showToast('취소 요청이 승인(삭제)되었습니다.', 'info');
            } else {
                await db.ref('leaves/' + id).update({ status: 'approved', rejectReason: null });
                showToast('휴가가 승인되었습니다.', 'info');
            }
        }
        // 승인/반려 처리 직후 목록 즉시 최신화
        if (typeof renderAdminLeaves === 'function') renderAdminLeaves();
    } catch (e) {
        await customAlert("처리 실패: " + e.message);
    }
}
async function adminEditTotalLeave(uid, currentTotal) {
    const newTotal = await customPrompt('연차 개수 설정:', currentTotal);
    if (newTotal) db.ref('users/' + uid).update({ leaveTotal: parseFloat(newTotal) });
}

function downloadLeaveCSV() {
    const leavesData = AppStore.getLeaves();
    if (!leavesData || Object.keys(leavesData).length === 0) {
        showToast('다운로드할 휴가 내역이 없습니다.', 'warning');
        return;
    }

    const usersData = AppStore.getUsers();
    const userStats = {};

    // 사용자별 기본 연차 세팅
    Object.keys(usersData).forEach(uid => {
        userStats[uid] = { total: usersData[uid].leaveTotal || 15, used: 0 };
    });

    // 사용자별 사용 연차 일괄 계산
    Object.values(leavesData).forEach(l => {
        if (l.uid && userStats[l.uid]) {
            if (l.status === 'approved' || l.status === 'pending' || l.status === 'cancel_requested') {
                userStats[l.uid].used += l.type;
            }
        }
    });

    // 한글 깨짐 방지를 위한 BOM(\uFEFF) 추가
    let csvContent = "\uFEFF결재 상태,이름,날짜,휴가 구분,차감 일수,현재 잔여 연차,비고\n";

    // 카테고리(상태)별로 먼저 그룹핑하고, 그 안에서 최신순 정렬
    const leavesArray = Object.values(leavesData).sort((a, b) => {
        const statusOrder = { 'approved': 1, 'rejected': 2, 'pending': 3, 'cancel_requested': 4, 'canceled': 5 };
        const orderA = statusOrder[a.status] || 99;
        const orderB = statusOrder[b.status] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return b.timestamp - a.timestamp;
    });

    leavesArray.forEach(l => {
        const name = l.userName || '알 수 없음';
        const date = l.date || '';
        const typeText = l.type === 1 ? '연차(1일)' : (l.subType === '0.5am' ? '오전 반차' : '오후 반차');
        const typeNum = l.type || 0;
        
        // 개별 팀원의 잔여 연차 매핑
        let remainDays = '-';
        if (l.uid && userStats[l.uid]) {
            remainDays = (userStats[l.uid].total - userStats[l.uid].used).toFixed(1) + '일';
        }

        let statusText = l.status === 'approved' ? '승인됨' : (l.status === 'pending' ? '대기중' : (l.status === 'cancel_requested' ? '취소 대기중' : (l.status === 'rejected' ? '반려됨' : '취소됨')));
        const note = l.rejectReason ? `반려사유: ${l.rejectReason}` : '';

        // CSV 형식에 맞게 문자열 내 쉼표, 따옴표 이스케이프 처리
        const safeName = `"${name.replace(/"/g, '""')}"`;
        const safeNote = `"${note.replace(/"/g, '""')}"`;

        csvContent += `${statusText},${safeName},${date},${typeText},${typeNum},${remainDays},${safeNote}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `휴가_결재_내역_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('휴가 내역 엑셀(CSV) 다운로드가 시작되었습니다.', 'info');
}

let previousPendingLeaves = new Set(), isFirstLeavesLoad = true;
// 휴가 데이터 최적화: 최신 300개만 로드
db.ref('leaves').orderByKey().limitToLast(300).on('value', (s) => {
    const data = s.val() || {}; 
    for(let key in data) data[key].id = key; 
    AppStore.setLeaves(data);
    if (auth.currentUser && auth.currentUser.uid === ADMIN_UID) {
        Object.values(data).forEach(l => { if (l.status === 'pending' && !isFirstLeavesLoad && !previousPendingLeaves.has(l.id)) showToast(`🚨 휴가 신청: ${l.userName}`, 'warning'); previousPendingLeaves.add(l.id); });
    }
    isFirstLeavesLoad = false;

    // 데이터 변경 시 화면 즉시 새로고침
    if (typeof renderLeaveUI === 'function') renderLeaveUI();
    if (typeof renderAdminLeaves === 'function') renderAdminLeaves();
});

function changeMyPageMonth(offset) { currentDateForMyPageCalendar.setMonth(currentDateForMyPageCalendar.getMonth() + offset); renderMyPage(); }

function renderMyPage() {
    const currentUserProfile = AppStore.getCurrentUser();
    const tasksList = document.getElementById('mypage-tasks'), tripsList = document.getElementById('mypage-trips'), leavesList = document.getElementById('mypage-leaves-list');
    const calGrid = document.getElementById('mypage-calendar-grid');
    if (!tasksList) return; tasksList.innerHTML = ''; tripsList.innerHTML = ''; if (leavesList) leavesList.innerHTML = ''; if(calGrid) calGrid.innerHTML = '';
    
    if (!auth.currentUser || !currentUserProfile) {
        const loginMsg = '<li style="justify-content: center; color: var(--text-muted); font-size: 0.9rem;">로그인 후 확인 가능합니다.</li>';
        tasksList.innerHTML = loginMsg; tripsList.innerHTML = loginMsg; if(leavesList) leavesList.innerHTML = loginMsg;
        if(document.getElementById('mypage-profile-card')) document.getElementById('mypage-profile-card').style.display = 'none';
        return;
    }

    if(document.getElementById('mypage-profile-card')) {
        document.getElementById('mypage-profile-card').style.display = 'flex';
        document.getElementById('mypage-avatar').src = currentUserProfile.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23E5E7EB'/%3E%3C/svg%3E";
        document.getElementById('mypage-name').textContent = currentUserProfile.displayName;
        document.getElementById('mypage-email').textContent = currentUserProfile.email;
        const deptMap = { 'ceo': '대표', 'health_leader': '헬스케어 (팀장)', 'health_member': '헬스케어 (팀원)', 'marketing': '마케팅부', 'bidding': '입찰사무원', 'unassigned': '부서 미지정' };
        document.getElementById('mypage-dept').textContent = deptMap[currentUserProfile.department || 'unassigned'];
    }
    
    const myName = currentUserProfile.displayName.replace(/\s+/g, '').toLowerCase();
    const isMatched = (str) => str && str.split(/[,/]+/).map(s => s.replace(/\s+/g, '').toLowerCase()).some(n => n.includes(myName) || myName.includes(n));
    
    Object.values(AppStore.getTasks()).filter(t => isMatched(t.assignee)).forEach(t => {
        const li = document.createElement('li'); 
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center';
        
        const statusText = t.status === 'todo' ? '해야 할 일' : (t.status === 'doing' ? '진행 중' : '완료');
        const statusColor = t.status === 'todo' ? 'var(--text-muted)' : (t.status === 'doing' ? '#F59E0B' : '#10B981');
        
        li.innerHTML = `<div style="flex:1; cursor:pointer;" class="mypage-task-info"><div style="font-weight:600;">${t.title}</div><div style="font-size:0.8rem;">마감: ${t.dueDate || '미정'}</div></div><button class="status-cycle-btn" style="background-color: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; box-shadow: none; flex-shrink: 0; margin-left: 0.5rem;" title="클릭하여 상태 변경">${statusText}</button>`;
        
        li.querySelector('.mypage-task-info').onclick = () => openModal(t.id, t.title, t.description, t.dueDate, t.startDate);
        li.querySelector('.status-cycle-btn').onclick = (e) => {
            e.stopPropagation();
            const nextStatus = t.status === 'todo' ? 'doing' : (t.status === 'doing' ? 'done' : 'todo');
            db.ref('tasks/' + t.id).update({ status: nextStatus });
        };
        tasksList.appendChild(li);
    });
    Object.values(AppStore.getTrips()).filter(t => isMatched(t.assignee)).forEach(t => {
        let reqGender = t.requiredGender || (t.requiresFemale ? 'female' : 'any');
        let reqPers = t.requiredPersonnel || 1;
        const femaleBadge = reqGender === 'female' ? ' 👩‍💼' : (reqGender === 'male' ? ' 👨‍💼' : '');
        const persBadge = `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-left:4px;">[${reqPers}명]</span>`;
        const li = document.createElement('li'); li.innerHTML = `<div style="font-weight:600;">${t.name}${persBadge}${femaleBadge}</div><div style="font-size:0.8rem;">날짜: ${t.date || '미정'}</div>`; li.onclick = () => openTripModal(t.id, t.name, t.date, t.assignee); tripsList.appendChild(li);
    });
    
    // 마이페이지의 내 휴가 결재 섹션에는 '승인된(approved)' 휴가만 노출되도록 필터링
    const myLeaves = Object.values(AppStore.getLeaves()).filter(l => l.uid === auth.currentUser.uid && l.status === 'approved');
    
    if (leavesList) {
        myLeaves.sort((a,b) => b.timestamp - a.timestamp).forEach(l => {
            const li = document.createElement('li'); 
            let statusText = '승인됨';
            let color = '#10B981';
            let reasonHtml = l.rejectReason ? `<div style="font-size:0.75rem; color:var(--danger); margin-top:2px;">사유: ${l.rejectReason}</div>` : '';
            li.innerHTML = `<div><div style="font-weight:600; font-size:0.9rem;">${l.date}</div><div style="font-size:0.75rem; color:${color}">${statusText} (${l.type}일)</div>${reasonHtml}</div>`; 
            leavesList.appendChild(li);
        });
    }
    
    if (calGrid) {
        buildCalendarGrid('mypage-calendar-grid', 'mypage-calendar-month-year', currentDateForMyPageCalendar, true, (cell, dateString, isCurrentMonth) => {
            if (isCurrentMonth) {
                myLeaves.filter(l => l.date === dateString).forEach(l => {
                    const el = document.createElement('div'); el.className = 'calendar-task'; el.style.padding = '2px'; el.style.fontSize = '0.7rem'; el.title = l.status;
                    let color = l.status === 'approved' ? '#10B981' : (l.status === 'rejected' ? 'var(--danger)' : '#F59E0B');
                    el.style.backgroundColor = color;
                    el.innerHTML = `<span class="material-symbols-rounded" style="font-size:1em; margin-right:2px;">${l.status === 'approved' ? 'check_circle' : 'pending'}</span>휴가`;
                    cell.appendChild(el);
                });
            }
        });
    }
}

// ----------------------------------------------------
// 실시간 문서 기능
// ----------------------------------------------------
let isTyping = false;
const quill = new Quill('#editor-container', {
    theme: 'snow',
    modules: { toolbar: [ [{ 'header': [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image'], ['clean'] ] },
    placeholder: '회의록이나 아이디어를 자유롭게 작성하세요...'
});

quill.on('text-change', function(delta, oldDelta, source) {
    const currentUserProfile = AppStore.getCurrentUser();
    if (source === 'user') {
        if (!currentUserProfile || !currentUserProfile.approved) return;
        isTyping = true;
        db.ref('sharedNote').set(quill.root.innerHTML);
        db.ref('typingStatus').set({ name: currentUserProfile.displayName, time: Date.now() });
        clearTimeout(window.typingTimer);
        window.typingTimer = setTimeout(() => { isTyping = false; db.ref('typingStatus').remove(); }, 1000);
    }
});

db.ref('sharedNote').on('value', (snapshot) => {
    if (!isTyping) { const content = snapshot.val() || ''; if (quill.root.innerHTML !== content) quill.root.innerHTML = content; }
});
db.ref('typingStatus').on('value', (snapshot) => {
    const currentUserProfile = AppStore.getCurrentUser();
    const indicator = document.getElementById('typing-indicator'), data = snapshot.val();
    if (data && data.name && (Date.now() - data.time < 3000)) {
        if (currentUserProfile && data.name === currentUserProfile.displayName) return indicator.classList.remove('active');
        indicator.textContent = `⋯ ${data.name}님이 작성 중입니다...`; indicator.classList.add('active');
    } else indicator.classList.remove('active');
});

// ----------------------------------------------------
// 파일 업로드 기능
// ----------------------------------------------------
async function uploadFile() {
    if (!(await checkAuth('승인된 사용자만 업로드 가능합니다.'))) return;
    const fileInput = document.getElementById('fileInput'), file = fileInput.files[0];
    if (!file) return await customAlert('파일을 선택해주세요.');
    if (file.size > 10 * 1024 * 1024) return await customAlert('파일 용량은 10MB를 초과할 수 없습니다.');

    document.getElementById('uploadStatus').innerText = '업로드 중...';
    const filePath = 'uploads/' + Date.now() + '_' + file.name;
    const uploaderName = AppStore.getCurrentUser() ? AppStore.getCurrentUser().displayName : '익명';
    storage.ref(filePath).put(file).then(snapshot => snapshot.ref.getDownloadURL().then(url => {
        db.ref('files').push().set({ id: Date.now().toString(), name: file.name, url: url, path: filePath, timestamp: Date.now(), uploader: uploaderName });
        document.getElementById('uploadStatus').innerText = '업로드 완료!'; fileInput.value = ''; updateFileName('fileInput', 'fileNameDisplay');
    })).catch(e => document.getElementById('uploadStatus').innerText = '업로드 실패');
}
async function deleteFile(fileId, filePath) {
    if (!await customConfirm('삭제하시겠습니까?')) return;
    storage.ref(filePath).delete().then(() => db.ref('files/' + fileId).remove());
}
// 파일 목록 최적화: 최신 100개만 로드
db.ref('files').orderByKey().limitToLast(100).on('value', (s) => {
    const list = document.getElementById('fileList'); list.innerHTML = '';
    const data = s.val(); if (!data) return;
    for(let key in data) data[key].id = key; // 진짜 DB 키로 강제 동기화
    Object.values(data).sort((a,b) => b.timestamp - a.timestamp).forEach(f => {
        const li = document.createElement('li'); li.innerHTML = `<a href="${f.url}" target="_blank" title="업로드: ${f.uploader || '알 수 없음'}">${f.name}</a> ${f.path ? `<button class="delete-btn" onclick="deleteFile('${f.id}', '${f.path}')">삭제</button>` : ''}`;
        list.appendChild(li);
    });
});

// ----------------------------------------------------
// 조직도(팀원 목록) 및 채팅 기능
// ----------------------------------------------------
db.ref('users').on('value', (snapshot) => { 
    AppStore.setUsers(snapshot.val() || {}); 
});

function renderMembersDirectory() {
    ['ceo', 'health_leader', 'health_member', 'marketing', 'bidding', 'unassigned'].forEach(id => { const el = document.getElementById('list-' + id); if (el) el.innerHTML = ''; });
    if (!auth.currentUser) return;
    const isAdmin = auth.currentUser.uid === ADMIN_UID;
    if (document.getElementById('org-admin-guide')) document.getElementById('org-admin-guide').style.display = isAdmin ? 'block' : 'none';

    Object.keys(AppStore.getUsers()).forEach(uid => {
        const u = AppStore.getUsers()[uid]; if (!u.approved) return;
        const card = document.createElement('div'); card.className = 'org-card' + (isAdmin ? ' draggable' : '');
        if (isAdmin) { card.draggable = true; card.ondragstart = (e) => e.dataTransfer.setData("uid", uid); }
        card.innerHTML = `<img src="${u.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23E5E7EB'/%3E%3C/svg%3E"}" style="width: 54px; height: 54px; border-radius: 50%; object-fit: cover;"><div style="flex:1;font-weight:800;font-size:1.1rem;">${u.displayName}</div>${uid !== auth.currentUser.uid ? `<button onclick="openPrivateChat('${uid}', '${u.displayName}')" class="delete-btn" style="background:var(--col-bg);color:var(--text-muted);"><span class="material-symbols-rounded">chat</span></button>` : ''}`;
        const target = document.getElementById('list-' + (u.department || 'unassigned')); if (target) target.appendChild(card);
    });
}
async function dropMember(ev, newDept) {
    ev.preventDefault(); const uid = ev.dataTransfer.getData("uid");
    if (uid) {
        if (auth.currentUser.uid !== ADMIN_UID) return await customAlert('최고 관리자만 수정 가능합니다.');
        db.ref('users/' + uid).update({ department: newDept });
    }
}
function allowDrop(ev) { ev.preventDefault(); }

let currentPrivateChatTargetUid = null, currentPrivateChatRef = null;
function getPrivateChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

function openPrivateChat(targetUid, targetName) {
    currentPrivateChatTargetUid = targetUid;
    document.getElementById('chat-list-window').style.display = 'none'; document.getElementById('chat-window').style.display = 'none';
    document.getElementById('private-chat-title').textContent = `${targetName}님과 채팅`; document.getElementById('private-chat-window').style.display = 'flex';
    if (currentPrivateChatRef) currentPrivateChatRef.off();
    
    currentPrivateChatRef = db.ref(`privateChats/${getPrivateChatId(auth.currentUser.uid, targetUid)}`).orderByChild('timestamp').limitToLast(50);
    currentPrivateChatRef.on('value', (s) => {
        const chatBody = document.getElementById('private-chat-messages'); chatBody.innerHTML = '';
        s.forEach(child => {
            const msg = child.val(), isMine = msg.uid === auth.currentUser.uid;
            const msgEl = document.createElement('div'); msgEl.className = `chat-message ${isMine ? 'mine' : 'others'}`;
            msgEl.innerHTML = `${!isMine ? `<div class="chat-sender">${msg.sender}</div>` : ''}<div class="chat-bubble">${msg.text}</div>`;
            chatBody.appendChild(msgEl);
        });
        setTimeout(() => chatBody.scrollTop = chatBody.scrollHeight, 10);
    });
}
function closePrivateChat() { document.getElementById('private-chat-window').style.display = 'none'; if (currentPrivateChatRef) currentPrivateChatRef.off(); currentPrivateChatTargetUid = null; }
function handlePrivateChatEnter(event) { if (event.key === 'Enter') { event.preventDefault(); sendPrivateMessage(); } }
async function sendPrivateMessage() {
    const currentUserProfile = AppStore.getCurrentUser();
    const text = document.getElementById('private-chat-input').value.trim(); if (!text || !currentPrivateChatTargetUid) return;
    db.ref(`privateChats/${getPrivateChatId(auth.currentUser.uid, currentPrivateChatTargetUid)}`).push({ uid: auth.currentUser.uid, sender: currentUserProfile.displayName, text: text, timestamp: Date.now() });
    document.getElementById('private-chat-input').value = '';
}

function toggleChatListWindow() {
    const listWindow = document.getElementById('chat-list-window'), groupWindow = document.getElementById('chat-window'), privateWindow = document.getElementById('private-chat-window');
    if (groupWindow.style.display === 'flex' || privateWindow.style.display === 'flex') { groupWindow.style.display = 'none'; privateWindow.style.display = 'none'; listWindow.style.display = 'flex'; return; }
    if (listWindow.style.display === 'none' || listWindow.style.display === '') { listWindow.style.display = 'flex'; renderChatList(); } else listWindow.style.display = 'none';
}
function backToChatList() { document.getElementById('chat-window').style.display = 'none'; closePrivateChat(); document.getElementById('chat-list-window').style.display = 'flex'; }
function openGroupChat() { document.getElementById('chat-list-window').style.display = 'none'; document.getElementById('chat-window').style.display = 'flex'; setTimeout(() => document.getElementById('chat-input').focus(), 100); }

function renderChatList() {
    const currentUserProfile = AppStore.getCurrentUser();
    const listBody = document.getElementById('chat-list-body'); if (!listBody) return; listBody.innerHTML = '';
    if (!auth.currentUser || !currentUserProfile || !currentUserProfile.approved) return;
    
    const groupItem = document.createElement('div'); groupItem.className = 'chat-list-item'; groupItem.onclick = openGroupChat;
    groupItem.innerHTML = `<div style="width:48px;height:48px;border-radius:18px;background:var(--primary);color:white;display:flex;justify-content:center;align-items:center;margin-right:12px;"><span class="material-symbols-rounded">groups</span></div><div style="flex:1;font-weight:700;">사내 단체 채팅방</div>`; listBody.appendChild(groupItem);
    
    Object.keys(AppStore.getUsers()).forEach(uid => {
        if (uid === auth.currentUser.uid) return;
        const u = AppStore.getUsers()[uid]; if (!u.approved) return;
        const item = document.createElement('div'); item.className = 'chat-list-item'; item.onclick = () => openPrivateChat(uid, u.displayName);
        item.innerHTML = `<img src="${u.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23E5E7EB'/%3E%3C/svg%3E"}" style="width:48px;height:48px;border-radius:18px;margin-right:12px; object-fit: cover;"><div style="flex:1;font-weight:600;">${u.displayName}</div>`; listBody.appendChild(item);
    });
}
function handleChatEnter(event) { if (event.key === 'Enter') { event.preventDefault(); sendChatMessage(); } }
async function sendChatMessage() {
    const currentUserProfile = AppStore.getCurrentUser();
    const text = document.getElementById('chat-input').value.trim(); if (!text) return;
    db.ref('chatMessages').push({ uid: auth.currentUser.uid, sender: currentUserProfile.displayName, text: text, timestamp: Date.now() });
    document.getElementById('chat-input').value = '';
}
db.ref('chatMessages').orderByChild('timestamp').limitToLast(50).on('value', (s) => {
    const chatBody = document.getElementById('chat-messages'); if (!chatBody) return; chatBody.innerHTML = '';
    s.forEach(child => {
        const msg = child.val(), isMine = auth.currentUser && auth.currentUser.uid === msg.uid;
        const msgEl = document.createElement('div'); msgEl.className = `chat-message ${isMine ? 'mine' : 'others'}`;
        msgEl.innerHTML = `${!isMine ? `<div class="chat-sender">${msg.sender}</div>` : ''}<div class="chat-bubble">${msg.text}</div>`; chatBody.appendChild(msgEl);
    });
    setTimeout(() => chatBody.scrollTop = chatBody.scrollHeight, 10);
});

let privateChatListeners = {}, initTimeForPrivateChats = Date.now();
function setupPrivateChatNotificationListeners() {
    const currentUid = auth.currentUser ? auth.currentUser.uid : null; if (!currentUid) return;
    Object.keys(AppStore.getUsers()).forEach(targetUid => {
        if (targetUid === currentUid) return;
        const chatId = getPrivateChatId(currentUid, targetUid);
        if (!privateChatListeners[chatId]) {
            db.ref(`privateChats/${chatId}`).limitToLast(1).on('child_added', (s) => {
                const msg = s.val();
                if (msg && msg.uid !== currentUid && msg.timestamp > initTimeForPrivateChats) {
                    showToast(`💬 ${AppStore.getUsers()[targetUid].displayName}님:\n${msg.text}`, 'info');
                    if (currentPrivateChatTargetUid !== targetUid) openPrivateChat(targetUid, AppStore.getUsers()[targetUid].displayName);
                }
            });
            privateChatListeners[chatId] = true;
        }
    });
}

// ----------------------------------------------------
// 전사 공지사항
// ----------------------------------------------------
let currentNoticeId = null;
function renderNotices() {
    const listEl = document.getElementById('notice-list'); if (!listEl) return; listEl.innerHTML = '';
    Object.values(AppStore.getNotices()).sort((a,b) => b.timestamp - a.timestamp).forEach(notice => {
        const li = document.createElement('li'); li.className = 'notice-item'; li.innerHTML = `<div class="notice-item-title">${notice.title}</div><div class="notice-item-author">${notice.author}</div>`;
        li.onclick = () => viewNotice(notice.id); listEl.appendChild(li);
    });
}
function viewNotice(id) { const notice = AppStore.getNotices()[id]; currentNoticeId = id; document.getElementById('noticeTitleInput').value = notice.title; document.getElementById('noticeContentInput').value = notice.content; document.getElementById('noticeModal').style.display = 'flex'; db.ref('notices/' + id + '/views').set((notice.views || 0) + 1); }
function openNoticeModal() { currentNoticeId = null; document.getElementById('noticeTitleInput').value = ''; document.getElementById('noticeContentInput').value = ''; document.getElementById('noticeModal').style.display = 'flex'; }
function closeNoticeModal() { document.getElementById('noticeModal').style.display = 'none'; currentNoticeId = null; }
async function saveNotice() {
    const currentUserProfile = AppStore.getCurrentUser();
    const title = document.getElementById('noticeTitleInput').value.trim(), content = document.getElementById('noticeContentInput').value.trim(); if (!title || !content) return;
    const data = { title: title, content: content, author: currentUserProfile.displayName, uid: auth.currentUser.uid, timestamp: currentNoticeId ? AppStore.getNotices()[currentNoticeId].timestamp : Date.now(), views: currentNoticeId ? AppStore.getNotices()[currentNoticeId].views : 0 };
    if (currentNoticeId) db.ref('notices/' + currentNoticeId).update(data); else { const ref = db.ref('notices').push(); data.id = ref.key; ref.set(data); }
    closeNoticeModal();
}
async function deleteNotice() { if (await customConfirm('삭제하시겠습니까?')) { db.ref('notices/' + currentNoticeId).remove(); closeNoticeModal(); } }

// 공지사항 데이터 실시간 동기화
// 공지사항 최적화: 최신 50개만 로드
db.ref('notices').orderByKey().limitToLast(50).on('value', (s) => { 
    const data = s.val() || {};
    for(let key in data) data[key].id = key; 
    AppStore.setNotices(data);

    if (typeof renderNotices === 'function') renderNotices();
});