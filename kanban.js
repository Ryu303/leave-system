// kanban.js
// ----------------------------------------------------
// 업무 현황 (칸반, 달력, 간트)
// ----------------------------------------------------
async function addTask() {
    const input = document.getElementById('taskInput');
    const title = input.value.trim();
    const assigneeInput = document.getElementById('assigneeInput');
    const assignee = assigneeInput.value.trim();
    const priorityInput = document.getElementById('priorityInput');
    const priority = priorityInput.value;

    if (!(await checkAuth('관리자의 승인 후 업무를 추가할 수 있습니다.'))) return;
    if (!title) return await customAlert('업무 내용을 입력해주세요!');

    const currentUser = auth.currentUser;
    const authorName = currentUser ? currentUser.displayName : '익명';
    const today = new Date();
    const startDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const newTaskRef = db.ref('tasks').push();
    newTaskRef.set({ id: newTaskRef.key, title: title, status: 'todo', author: authorName, assignee: assignee, priority: priority, startDate: startDateString })
        .catch(async (error) => await customAlert("추가 실패: " + error.message));
    
    input.value = ''; assigneeInput.value = ''; priorityInput.value = 'medium';
    document.getElementById('searchAssignee').value = '';
    document.getElementById('dateFilter').value = 'all';

    if (AppStore.getViewMode() === 'calendar') {
        document.getElementById('viewMode').value = 'status';
        toggleViewMode();
        customAlert("달력에는 마감일이 있는 업무만 표시됩니다. \n방금 추가한 업무 확인을 위해 '상태별 보기'로 전환했습니다!");
    } else {
        filterTasks(); 
    }
}

document.getElementById('taskInput').addEventListener('keypress', function(e) { if (e.key === 'Enter') addTask(); });
document.getElementById('assigneeInput').addEventListener('keypress', function(e) { if (e.key === 'Enter') addTask(); });

async function deleteTask(id) {
    if (!(await checkAuth('승인된 사용자만 삭제할 수 있습니다.'))) return;
    if(await customConfirm('이 업무를 삭제할까요?')) { db.ref('tasks/' + id).remove(); }
}

function allowDrop(ev) { 
    ev.preventDefault(); 
    // 마우스가 위치한 가장 가까운 컬럼을 찾아 하이라이트 효과 적용
    const col = ev.target.closest('.column');
    document.querySelectorAll('.column').forEach(c => {
        if (c !== col) c.classList.remove('drag-over');
    });
    if (col && !col.classList.contains('drag-over')) col.classList.add('drag-over');
}

function drag(ev, id) { 
    ev.dataTransfer.setData("text", id); 
    // 애니메이션이 부드럽게 먹히도록 setTimeout 사용 (드래그 시작 즉시 투명도 적용)
    setTimeout(() => { if (ev.target && ev.target.classList) ev.target.classList.add('is-dragging'); }, 0);
}

async function drop(ev, newStatus) {
    ev.preventDefault();
    document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
    const taskId = ev.dataTransfer.getData("text");
    if (taskId) { 
        if (!(await checkAuth('승인된 사용자만 상태를 변경할 수 있습니다.'))) return;
        db.ref('tasks/' + taskId).update({ status: newStatus }).catch(async (error) => await customAlert("상태 변경 실패: " + error.message));
    }
}

function filterTasks() {
    const searchTerm = document.getElementById('searchAssignee').value.toLowerCase().trim();
    const dateFilter = document.getElementById('dateFilter').value;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const counts = { todo: 0, doing: 0, done: 0, week: 0, month: 0, later: 0 };

    document.querySelectorAll('.task-card').forEach(card => {
        const assignee = card.dataset.assignee.toLowerCase();
        const dueDateStr = card.dataset.dueDate;
        let nameMatch = assignee.includes(searchTerm);
        let dateMatch = true;

        if (dateFilter !== 'all') {
            if (!dueDateStr) dateMatch = false;
            else {
                const taskDate = new Date(dueDateStr); taskDate.setHours(0, 0, 0, 0);
                if (dateFilter === 'today') dateMatch = taskDate <= today;
                else if (dateFilter === 'week') dateMatch = taskDate <= endOfWeek;
                else if (dateFilter === 'month') dateMatch = taskDate <= endOfMonth;
            }
        }
        if (nameMatch && dateMatch) { 
            card.style.display = 'flex'; 
            if (card.parentElement) {
                const colId = card.parentElement.id.replace('-list', '');
                if (counts[colId] !== undefined) counts[colId]++;
            }
        } else { card.style.display = 'none'; }
    });

    Object.keys(counts).forEach(col => {
        const badge = document.getElementById(`count-${col}`);
        if (badge) badge.textContent = counts[col];
    });

    document.querySelectorAll('.calendar-task').forEach(taskEl => {
        if (taskEl.dataset.assignee.toLowerCase().includes(searchTerm)) taskEl.style.display = 'block';
        else taskEl.style.display = 'none';
    });

    document.querySelectorAll('.gantt-row').forEach(row => {
        const tripGroups = row.querySelectorAll('.gantt-trip-group');
        if (tripGroups.length > 0) {
            let rowHasVisibleTrip = false;
            tripGroups.forEach(bar => {
                if ((bar.dataset.assignee || '').toLowerCase().includes(searchTerm)) {
                    bar.style.display = 'flex'; rowHasVisibleTrip = true;
                } else bar.style.display = 'none';
            });
            row.style.display = rowHasVisibleTrip ? 'flex' : 'none';
        } else {
            if ((row.dataset.assignee || '').toLowerCase().includes(searchTerm)) row.style.display = 'flex';
            else row.style.display = 'none';
        }
    });

    document.querySelectorAll('.trip-card').forEach(card => {
        const assignee = (card.dataset.assignee || '').toLowerCase();
        const dateStr = card.dataset.date;
        let nameMatch = assignee.includes(searchTerm);
        let dateMatch = true;

        if (dateFilter !== 'all') {
            if (!dateStr) dateMatch = false;
            else {
                const tripDate = new Date(dateStr); tripDate.setHours(0, 0, 0, 0);
                if (dateFilter === 'today') dateMatch = tripDate <= today;
                else if (dateFilter === 'week') dateMatch = tripDate <= endOfWeek;
                else if (dateFilter === 'month') dateMatch = tripDate <= endOfMonth;
            }
        }
        if (nameMatch && dateMatch) card.style.display = 'flex'; 
        else card.style.display = 'none';
    });
}

let currentModalTaskId = null;
function openModal(taskId, title, description, dueDate, startDate) {
    currentModalTaskId = taskId;
    document.getElementById('modalTitleInput').value = title;
    document.getElementById('modalDescription').value = description || '';
    document.getElementById('modalStartDate').value = startDate || '';
    document.getElementById('modalDueDate').value = dueDate || '';
    
    const task = AppStore.getTasks()[taskId];
    document.getElementById('taskAuthorDisplay').textContent = task && task.author ? `등록: ${task.author}` : '';

    document.getElementById('taskModal').style.display = 'flex';
}

function closeModal() { document.getElementById('taskModal').style.display = 'none'; currentModalTaskId = null; }

async function saveDescription() {
    if (!(await checkAuth('승인된 사용자만 저장할 수 있습니다.'))) return;
    if (!currentModalTaskId) return;
    
    const newTitle = document.getElementById('modalTitleInput').value.trim();
    if (!newTitle) return await customAlert('업무 제목을 입력해주세요.');
    
    db.ref('tasks/' + currentModalTaskId).update({
        title: newTitle, description: document.getElementById('modalDescription').value.trim(),
        startDate: document.getElementById('modalStartDate').value, dueDate: document.getElementById('modalDueDate').value
    }).then(() => closeModal()).catch(async error => await customAlert("저장 실패: " + error.message));
}

document.getElementById('taskModal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); saveDescription(); }
});

function openCommonCalendarModal() { document.getElementById('commonCalendarModal').style.display = 'flex'; renderModalCalendar(); }
function closeCommonCalendarModal() { document.getElementById('commonCalendarModal').style.display = 'none'; }
function changeModalMonth(offset) { currentDateForModalCalendar.setMonth(currentDateForModalCalendar.getMonth() + offset); renderModalCalendar(); }

function buildCalendarGrid(gridId, titleId, dateObj, isMyPage, renderCallback) {
    const grid = document.getElementById(gridId); if (!grid) return; grid.innerHTML = '';
    const year = dateObj.getFullYear(), month = dateObj.getMonth();
    document.getElementById(titleId).textContent = `${year}년 ${month + 1}월`;
    
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    ['일', '월', '화', '수', '목', '금', '토'].forEach((day, index) => {
        const h = document.createElement('div'); h.className = `calendar-day-header ${index===0?'sun':index===6?'sat':''}`; 
        if (isMyPage) { h.style.padding = '0.4rem'; h.style.fontSize = '0.8rem'; }
        h.textContent = day; grid.appendChild(h);
    });
    
    let currentDay = 1, nextMonthDay = 1, today = new Date();
    for (let i = 0; i < 42; i++) {
        const cell = document.createElement('div'); cell.className = 'calendar-day' + (isMyPage ? ' mypage-calendar-day' : '');
        let cellDate;
        if (i < firstDay) { cell.classList.add('other-month'); const d = new Date(year, month, 0).getDate() - firstDay + i + 1; cell.innerHTML = `<div class="calendar-date"${isMyPage?' style="font-size:0.75rem;"':''}>${d}</div>`; cellDate = new Date(year, month - 1, d); }
        else if (currentDay <= daysInMonth) { if (year === today.getFullYear() && month === today.getMonth() && currentDay === today.getDate()) cell.classList.add('today'); cell.innerHTML = `<div class="calendar-date"${isMyPage?' style="font-size:0.75rem;"':''}>${currentDay}</div>`; cellDate = new Date(year, month, currentDay); currentDay++; }
        else { cell.classList.add('other-month'); cell.innerHTML = `<div class="calendar-date"${isMyPage?' style="font-size:0.75rem;"':''}>${nextMonthDay}</div>`; cellDate = new Date(year, month + 1, nextMonthDay); nextMonthDay++; }
        
        const dateString = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        renderCallback(cell, dateString, !cell.classList.contains('other-month'));
        grid.appendChild(cell);
    }
}

function renderModalCalendar() {
    const priorityWeight = { 'high': 3, 'medium': 2, 'low': 1 };
    const tasksArray = Object.values(AppStore.getTasks()).sort((a, b) => (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2));
    const tripsArray = Object.values(AppStore.getTrips()).map(t => {
        let reqGender = t.requiredGender || (t.requiresFemale ? 'female' : 'any');
        let badge = reqGender === 'female' ? ' 👩‍💼' : (reqGender === 'male' ? ' 👨‍💼' : '');
        let reqPers = t.requiredPersonnel || 1;
        return { ...t, isTrip: true, title: `⚑ [출장] ${t.name} [${reqPers}명]${badge}`, startDate: t.date, dueDate: t.date, status: 'todo' };
    });
    const leavesArray = Object.values(AppStore.getLeaves()).filter(l => l.status === 'approved').map(l => ({ id: l.id, isLeave: true, title: `[휴가] ${l.userName}`, name: `[휴가] ${l.userName}`, assignee: l.userName, startDate: l.date, dueDate: l.date, status: 'todo', priority: 'medium' }));
    const combinedArray = [...tasksArray, ...tripsArray, ...leavesArray];

    buildCalendarGrid('modal-calendar-grid', 'modal-calendar-month-year', currentDateForModalCalendar, false, (cell, dateString) => {
        combinedArray.forEach(task => {
            if (task.dueDate === dateString) {
                const el = document.createElement('div'); el.className = 'calendar-task'; el.title = task.title;
                let statusIcon = task.isLeave ? '🌴 ' : (!task.isTrip && task.status === 'done' ? '✓ ' : '');
                el.textContent = statusIcon + task.title;
                el.style.backgroundColor = task.isLeave ? '#10B981' : task.isTrip ? '#8B5CF6' : (task.priority === 'high' ? 'var(--danger)' : task.priority === 'low' ? '#10B981' : '#F59E0B');
                if (task.status === 'done' && !task.isTrip) el.classList.add('task-done-style');
                
                el.onclick = () => {
                    closeCommonCalendarModal();
                    if (task.isLeave) customAlert(`🌴 휴가: ${task.assignee}`);
                    else if (task.isTrip) openTripModal(task.id, task.name, task.date, task.assignee, task.contact, task.address, task.scheduleUrl, task.schedulePath, task.qrUrl, task.qrPath);
                    else openModal(task.id, task.title, task.description, task.dueDate, task.startDate);
                };
                cell.appendChild(el);
            }
        });
    });
}

function toggleViewMode() {
    AppStore.setViewMode(document.getElementById('viewMode').value);
    ['board-status', 'board-timeline', 'board-calendar', 'board-gantt'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(`board-${AppStore.getViewMode()}`).style.display = AppStore.getViewMode() === 'gantt' ? 'block' : 'flex';
}
function changeMonth(offset) { currentDateForCalendar.setMonth(currentDateForCalendar.getMonth() + offset); renderTasks(); }
function changeGanttMonth(offset) { currentDateForGantt.setMonth(currentDateForGantt.getMonth() + offset); renderTasks(); }

function renderCalendar(tasksArray) {
    buildCalendarGrid('calendar-grid', 'calendar-month-year', currentDateForCalendar, false, (cell, dateString) => {
        tasksArray.forEach(task => {
            if (task.dueDate === dateString) {
                const el = document.createElement('div'); el.className = 'calendar-task'; el.title = task.title; el.dataset.assignee = task.assignee || '미지정';
                el.innerHTML = task.isLeave ? '<span class="material-symbols-rounded" style="font-size:1.1em; margin-right:4px;">beach_access</span>' : (task.isTrip ? '<span class="material-symbols-rounded" style="font-size:1.1em; margin-right:4px;">flight_takeoff</span>' : (task.status === 'done' ? '<span class="material-symbols-rounded" style="font-size:1.1em; margin-right:4px;">check_circle</span>' : ''));
                el.appendChild(document.createTextNode(task.title));
                el.style.backgroundColor = task.isLeave ? '#10B981' : task.isTrip ? '#8B5CF6' : (task.priority === 'high' ? 'var(--danger)' : task.priority === 'low' ? '#10B981' : '#F59E0B');
                if (task.status === 'done' && !task.isTrip) el.classList.add('task-done-style');
                
                el.onclick = () => {
                    if (task.isLeave) customAlert(`🌴 휴가: ${task.assignee}`);
                    else if (task.isTrip) openTripModal(task.id, task.name, task.date, task.assignee, task.contact, task.address, task.scheduleUrl, task.schedulePath, task.qrUrl, task.qrPath);
                    else openModal(task.id, task.title, task.description, task.dueDate, task.startDate);
                };
                cell.appendChild(el);
            }
        });
    });
}

function openTripGroupModal(titleText, items) {
    document.getElementById('tripGroupTitle').textContent = titleText;
    const listEl = document.getElementById('tripGroupList'); listEl.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li'); li.style.cursor = 'pointer';
        let icon = item.isLeave ? 'beach_access' : (item.isTrip ? 'flight_takeoff' : 'radio_button_unchecked');
        if (!item.isTrip && !item.isLeave) { if (item.status === 'doing') icon = 'pending'; if (item.status === 'done') icon = 'check_circle'; }
        const color = item.isLeave ? '#10B981' : (item.isTrip ? '#8B5CF6' : 'var(--text-main)');
        const titleToDisplay = item.isLeave || item.isTrip ? item.name : item.title;
        const subtitle = item.isLeave || item.isTrip ? `<span class="material-symbols-rounded" style="font-size:1.1em;">person</span> ${item.assignee || '미지정'} | <span class="material-symbols-rounded" style="font-size:1.1em;">location_on</span> ${item.address || '주소 미입력'}` : `<span class="material-symbols-rounded" style="font-size:1.1em;">person</span> ${item.assignee || '미지정'} | 중요도: ${item.priority === 'high' ? '높음' : (item.priority === 'low' ? '낮음' : '보통')}`;
        
        li.innerHTML = `<div style="display: flex; flex-direction: column; gap: 0.3rem;"><span style="color: ${color}; font-size: 0.95rem; font-weight: 600; display:flex; align-items:center;"><span class="material-symbols-rounded" style="font-size:1.2em; margin-right:4px;">${icon}</span> ${titleToDisplay}</span><span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">${subtitle}</span></div>`;
        li.onclick = () => {
            closeTripGroupModal();
            if (item.isLeave) customAlert(`🌴 휴가: ${item.assignee}`);
            else if (item.isTrip) openTripModal(item.id, item.name, item.date, item.assignee, item.contact, item.address, item.scheduleUrl, item.schedulePath, item.qrUrl, item.qrPath);
            else openModal(item.id, item.title, item.description, item.dueDate, item.startDate);
        };
        listEl.appendChild(li);
    });
    document.getElementById('tripGroupModal').style.display = 'flex';
}
function closeTripGroupModal() { document.getElementById('tripGroupModal').style.display = 'none'; }

function renderGantt(tasksArray) {
    const header = document.getElementById('gantt-header'), body = document.getElementById('gantt-body');
    const todayTime = new Date().setHours(0,0,0,0);
    header.innerHTML = '<div class="gantt-row-label" style="border-right: 2px solid var(--border-color); border-bottom: none; background-color: var(--card-bg); z-index: 20;">업무명</div>';
    body.innerHTML = '';

    const year = currentDateForGantt.getFullYear(), month = currentDateForGantt.getMonth();
    document.getElementById('gantt-month-year').textContent = `${year}년 ${month + 1}월`;
    const startDay = new Date(year, month, 1), endDay = new Date(year, month + 1, 0);
    const timelineWidth = endDay.getDate() * 40;

    for (let i = 1; i <= endDay.getDate(); i++) {
        const d = new Date(year, month, i), dayEl = document.createElement('div');
        dayEl.className = 'gantt-day'; if (d.setHours(0,0,0,0) === todayTime) dayEl.classList.add('today');
        dayEl.textContent = i; header.appendChild(dayEl);
    }

    const undatedItems = tasksArray.filter(t => t.isTrip ? !t.startDate : (t.isLeave ? false : (!t.startDate && !t.dueDate)));
    const datedTrips = tasksArray.filter(t => t.isTrip && t.startDate);
    const datedLeaves = tasksArray.filter(t => t.isLeave && t.startDate);
    const datedTasks = tasksArray.filter(t => !t.isTrip && !t.isLeave && (t.startDate || t.dueDate));

    if (undatedItems.length > 0) {
        const row = document.createElement('div'); row.className = 'gantt-row';
        const label = document.createElement('div'); label.className = 'gantt-row-label'; label.style.color = 'var(--text-muted)'; label.innerHTML = '<span class="material-symbols-rounded" style="font-size:1.2em; margin-right:6px;">calendar_today</span> 날짜 미지정 (통합)'; row.appendChild(label);
        const barArea = document.createElement('div'); barArea.className = 'gantt-bar-area'; barArea.style.width = `${timelineWidth}px`;
        const bar = document.createElement('div'); bar.className = 'gantt-bar gantt-trip-group'; bar.dataset.assignee = undatedItems.map(t => t.assignee || '').join(' ').toLowerCase();
        bar.style.left = `${Math.round((todayTime - startDay.getTime()) / 86400000) * 40}px`; bar.style.width = `40px`; bar.style.backgroundColor = 'var(--text-muted)';
        bar.title = undatedItems.map(t => `${t.isTrip || t.isLeave ? t.name : t.title} (${t.assignee || '미지정'})`).join('\n');
        if (undatedItems.length > 1) { bar.textContent = `${undatedItems.length}건`; bar.onclick = () => openTripGroupModal(`🗓 날짜 미지정 목록`, undatedItems); } 
        else { bar.textContent = undatedItems[0].assignee || '미지정'; bar.onclick = () => undatedItems[0].isTrip ? openTripModal(undatedItems[0].id, undatedItems[0].name, undatedItems[0].date, undatedItems[0].assignee) : openModal(undatedItems[0].id, undatedItems[0].title, undatedItems[0].description, undatedItems[0].dueDate, undatedItems[0].startDate); }
        barArea.appendChild(bar); row.appendChild(barArea); body.appendChild(row);
    }

    datedTasks.forEach(task => {
        let startT = todayTime; if (task.startDate) { const p = new Date(task.startDate).setHours(0,0,0,0); if (!isNaN(p)) startT = p; }
        let dueT = startT; if (task.dueDate) { const p = new Date(task.dueDate).setHours(0,0,0,0); if (!isNaN(p)) dueT = p; }
        if (dueT < startT) dueT = startT;
        const startIndex = Math.round((startT - startDay.getTime()) / 86400000);
        const duration = Math.round((dueT - startT) / 86400000) + 1;

        const row = document.createElement('div'); row.className = 'gantt-row'; row.dataset.assignee = task.assignee || '미지정';
        const label = document.createElement('div'); label.className = 'gantt-row-label';
        let statusIcon = task.status === 'todo' ? 'radio_button_unchecked' : (task.status === 'doing' ? 'pending' : 'check_circle');
        label.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.1em; margin-right:4px;">${statusIcon}</span>`; label.appendChild(document.createTextNode(task.title)); label.title = task.title;
        
        const barArea = document.createElement('div'); barArea.className = 'gantt-bar-area'; barArea.style.width = `${timelineWidth}px`;
        const bar = document.createElement('div'); bar.className = 'gantt-bar'; bar.style.left = `${startIndex * 40}px`; bar.style.width = `${duration * 40}px`;
        bar.style.backgroundColor = task.priority === 'high' ? 'var(--danger)' : (task.priority === 'low' ? '#10B981' : '#F59E0B');
        if (task.status === 'done') bar.classList.add('task-done-style');
        bar.textContent = task.assignee || '미지정'; 
        
        // 마우스 오버 시 표시될 상세 툴팁(title) 추가
        let priorityLabel = task.priority === 'high' ? '높음' : (task.priority === 'low' ? '낮음' : '보통');
        let statusLabel = task.status === 'todo' ? '해야 할 일' : (task.status === 'doing' ? '진행 중' : '완료');
        let tooltipText = `[${statusLabel}] ${task.title}\n담당자: ${task.assignee || '미지정'}\n중요도: ${priorityLabel}\n일정: ${task.startDate || '미정'} ~ ${task.dueDate || '미정'}`;
        if (task.description) tooltipText += `\n상세: ${task.description}`;
        bar.title = tooltipText;
        
        bar.onclick = () => openModal(task.id, task.title, task.description, task.dueDate, task.startDate);
        barArea.appendChild(bar); row.appendChild(label); row.appendChild(barArea); body.appendChild(row);
    });
}

function renderTasks() {
    ['todo-list', 'doing-list', 'done-list', 'week-list', 'month-list', 'later-list'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerHTML = ''; });
    const tasksData = AppStore.getTasks();
    if (!tasksData) return;

    const priorityWeight = { 'high': 3, 'medium': 2, 'low': 1 };
    const tasksArray = Object.values(tasksData).sort((a, b) => (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2));
    
    const progressFill = document.getElementById('progress-fill'), progressText = document.getElementById('progress-text');
    if (progressFill && progressText) {
        const p = tasksArray.length === 0 ? 0 : Math.round((tasksArray.filter(t => t.status === 'done').length / tasksArray.length) * 100);
        progressFill.style.width = p + '%'; progressText.textContent = p + '%';
    }

    const tripsArray = Object.values(AppStore.getTrips()).map(t => {
        let reqGender = t.requiredGender || (t.requiresFemale ? 'female' : 'any');
        let reqPers = t.requiredPersonnel || 1;
        
        let htmlBadges = `<span style="font-size:0.65rem; background-color:var(--col-bg); color:var(--text-muted); padding:2px 4px; border-radius:4px; margin-left:6px; font-weight:bold; vertical-align:middle; border:1px solid var(--border-color);">${reqPers}명</span>`;
        if (reqGender === 'female') htmlBadges += `<span style="font-size:0.65rem; background-color:#FCE7F3; color:#EC4899; padding:2px 4px; border-radius:4px; margin-left:4px; font-weight:bold; vertical-align:middle;">👩‍💼 여성</span>`;
        else if (reqGender === 'male') htmlBadges += `<span style="font-size:0.65rem; background-color:#E0F2FE; color:#3B82F6; padding:2px 4px; border-radius:4px; margin-left:4px; font-weight:bold; vertical-align:middle;">👨‍💼 남성</span>`;

        return { ...t, isTrip: true, title: `⚑ [출장] ${t.name}`, badgesHtml: htmlBadges, startDate: t.date, dueDate: t.date, status: 'todo' };
    });
    const leavesArray = Object.values(AppStore.getLeaves()).filter(l => l.status === 'approved').map(l => ({ id: l.id, isLeave: true, title: `[휴가] ${l.userName}`, assignee: l.userName, startDate: l.date, dueDate: l.date, status: 'todo', priority: 'medium' }));
    const combinedArray = [...tasksArray, ...tripsArray, ...leavesArray];

    if (AppStore.getViewMode() === 'calendar') { renderCalendar(combinedArray); filterTasks(); return; }
    if (AppStore.getViewMode() === 'gantt') { renderGantt(combinedArray); filterTasks(); return; }

    const today = new Date(); today.setHours(0,0,0,0);
    const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    tasksArray.forEach(task => {
        const div = document.createElement('div'); div.className = 'task-card';
        div.title = task.author ? `등록자: ${task.author}` : '';
        if (AppStore.getViewMode() === 'status') { 
            div.draggable = true; 
            div.ondragstart = (e) => drag(e, task.id); 
            // 카드를 놓거나 드래그가 취소될 때 효과 원상복구
            div.ondragend = (e) => { e.target.classList.remove('is-dragging'); document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over')); };
        }
        div.onclick = (e) => { if(!e.target.classList.contains('delete-btn')) openModal(task.id, task.title, task.description, task.dueDate, task.startDate); };
        div.dataset.assignee = task.assignee || '미지정'; div.dataset.dueDate = task.dueDate || '';

        let priorityLabel = task.priority === 'high' ? '높음' : (task.priority === 'low' ? '낮음' : '보통');
        let priorityColor = task.priority === 'high' ? '#EF4444' : (task.priority === 'low' ? '#10B981' : '#F59E0B');
        const descIcon = task.description ? '<span style="font-size: 0.7rem; margin-right: 6px; padding: 2px 4px; background-color: var(--col-bg); border-radius: 4px; color: var(--text-muted);">상세</span>' : '';
        let dueBadge = '';
        if (task.dueDate) {
            const taskDate = new Date(task.dueDate); taskDate.setHours(0,0,0,0);
            const isOverdue = taskDate < today && task.status !== 'done';
            dueBadge = `<span style="font-size: 0.75rem; color: ${isOverdue ? 'var(--danger)' : 'var(--text-main)'}; font-weight: 600;">${isOverdue ? '마감지연' : '마감일'} ${task.dueDate}</span>`;
        }

        div.innerHTML = `<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;"><span style="font-weight: 500; font-size: 0.95rem; word-break: break-all;">${task.title}${task.badgesHtml || ''}</span><button class="delete-btn" onclick="deleteTask('${task.id}')" title="삭제" style="padding:0.2rem; flex-shrink: 0; margin-left: 0.5rem;"><span class="material-symbols-rounded" style="font-size:1.1em;">close</span></button></div>
            ${(descIcon || dueBadge) ? `<div style="display: flex; align-items: center; margin-top: -0.2rem;">${descIcon}${dueBadge}</div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;"><span style="color: var(--text-muted);">담당: ${task.assignee || '미지정'}</span><span style="background-color: ${priorityColor}15; color: ${priorityColor}; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600;">${priorityLabel}</span></div>
        </div>`;
        
        if (AppStore.getViewMode() === 'status') { const el = document.getElementById(`${task.status}-list`); if(el) el.appendChild(div); } 
        else {
            let targetList = 'later-list';
            if (task.dueDate) {
                const d = new Date(task.dueDate); d.setHours(0,0,0,0);
                if (d <= endOfWeek) targetList = 'week-list'; else if (d <= endOfMonth) targetList = 'month-list';
            }
            const el = document.getElementById(targetList); if(el) el.appendChild(div); 
        }
    });
    filterTasks();
}

db.ref('tasks').orderByChild('status').equalTo('todo').on('value', (s) => {
    const data = s.val() || {};
    AppStore.mergeTasks(data, 'todo');
});

db.ref('tasks').orderByChild('status').equalTo('doing').on('value', (s) => {
    const data = s.val() || {};
    AppStore.mergeTasks(data, 'doing');
});

db.ref('tasks').orderByChild('status').equalTo('done').limitToLast(50).on('value', (s) => {
    const data = s.val() || {};
    AppStore.mergeTasks(data, 'done');
});