// main.js
// ----------------------------------------------------
// 인증(로그인), 상태 리스너, 사용자/권한 관리 및 초기화
// ----------------------------------------------------
function loginWithGoogle() {
    auth.signInWithPopup(provider).then((result) => {
        console.log("로그인 성공:", result.user.displayName);
    }).catch(async (error) => {
        console.error("로그인 에러:", error);
        if (error.code === 'auth/unauthorized-domain' || error.message.includes('disallowed_useragent')) {
            await customAlert('보안 정책에 따라 앱 내장 브라우저에서는 로그인이 제한됩니다.\n\n우측 상단 메뉴(점 3개)를 눌러 [다른 브라우저로 열기] 또는 [Chrome에서 열기]를 선택해 주세요!');
        } else {
            await customAlert('로그인에 실패했습니다. (' + error.message + ')');
        }
    });
}

async function logout() {
    if(await customConfirm('로그아웃 하시겠습니까?')) { auth.signOut(); }
}

auth.onAuthStateChanged((user) => {
    if (user) {
        const userRef = db.ref('users/' + user.uid);
        userRef.on('value', (snapshot) => {
            let profileData;
            
            if (!snapshot.exists()) {
                profileData = {
                    displayName: user.displayName, email: user.email, photoURL: user.photoURL || '',
                    approved: false, leaveTotal: 15
                };
                userRef.set(profileData);
            } else {
                profileData = snapshot.val();
                if (user.uid === ADMIN_UID && !profileData.approved) {
                    db.ref('users/' + user.uid).update({ approved: true });
                    profileData.approved = true;
                }
            }
            
            AppStore.setCurrentUser(profileData);

            if(typeof renderLeaveUI === 'function') renderLeaveUI();
            if(typeof renderMyPage === 'function') renderMyPage();
            if(typeof setupPrivateChatNotificationListeners === 'function') setupPrivateChatNotificationListeners();

            updateUIPermissions(user, AppStore.getCurrentUser());

            if (user.uid === ADMIN_UID) {
                document.getElementById('tab-btn-admin').style.display = 'inline-block';
                listenForUsers(); 
                if(typeof renderAdminLeaves === 'function') renderAdminLeaves();
            } else {
                document.getElementById('tab-btn-admin').style.display = 'none';
            }
        });
    } else {
        // 로그아웃 시 AppStore 초기화
        AppStore.setCurrentUser(null);
        updateUIPermissions(null, null);
        if (document.getElementById('tab-btn-admin')) document.getElementById('tab-btn-admin').style.display = 'none';
        if(typeof renderMyPage === 'function') renderMyPage();
        switchTab('tab-tasks', document.querySelector('.tab-btn'));
    }
});

function updateUIPermissions(user, profile) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const controls = [document.getElementById('taskInput'), document.querySelector('.task-input-area button'), document.getElementById('assigneeInput'), document.getElementById('priorityInput'), document.getElementById('fileInput'), document.querySelector('.upload-area button'), document.getElementById('addTripBtn'), document.getElementById('addNoticeBtn')];

    const isLoggedIn = !!user;
    const isApproved = isLoggedIn && profile && profile.approved;

    loginBtn.style.display = isLoggedIn ? 'none' : 'inline-block';
    logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';

    if (isLoggedIn) {
        userAvatar.src = user.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23E5E7EB'/%3E%3C/svg%3E";
        userAvatar.style.display = 'block';
        
        if (isApproved) {
            userInfo.textContent = `${user.displayName}님 환영합니다!`;
            controls.forEach(el => { if (el) el.disabled = false; });
            if (typeof quill !== 'undefined') quill.enable(true);
        } else {
            userInfo.textContent = `관리자의 승인을 기다리고 있습니다.`;
            controls.forEach(el => { if (el) el.disabled = true; });
            if (typeof quill !== 'undefined') quill.enable(false);
        }
    } else {
        userInfo.textContent = '';
        userAvatar.style.display = 'none';
        controls.forEach(el => { if (el) el.disabled = true; });
        if (typeof quill !== 'undefined') quill.enable(false);
    }
}

function updateFileName(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (input.files.length > 0) {
        display.textContent = input.files[0].name;
    } else {
        if (inputId === 'fileInput') {
            display.textContent = '선택된 파일 없음';
        } else {
            const existingUrl = input.dataset.existingUrl;
            display.textContent = existingUrl ? `현재 첨부됨: ${input.dataset.existingPath.split('_').pop()}` : '';
        }
    }
}

function listenForUsers() {
    db.ref('users').on('value', (snapshot) => {
        const approvalListEl = document.getElementById('user-approval-list');
        const memberListEl = document.getElementById('user-member-list');
        approvalListEl.innerHTML = '';
        memberListEl.innerHTML = '';
        
        const users = snapshot.val();
        if (!users) {
            approvalListEl.innerHTML = '<li>대기 중인 사용자가 없습니다.</li>';
            memberListEl.innerHTML = '<li>멤버가 없습니다.</li>';
            return;
        }

        let pendingCount = 0, memberCount = 0;
        Object.keys(users).forEach(uid => {
            const user = users[uid];
            const li = document.createElement('li');
            const safeName = user.displayName ? user.displayName.replace(/'/g, "\\'") : '이름없음';
            
            if (!user.approved) {
                li.innerHTML = `<span>${user.displayName} <small style="color: var(--text-muted); font-weight: normal;">(${user.email})</small></span><button onclick="approveUser('${uid}', '${safeName}')">승인</button>`;
                approvalListEl.appendChild(li); pendingCount++;
            } else {
                const actionBtn = uid === ADMIN_UID ? `<span style="font-size: 0.8rem; color: var(--primary); font-weight: bold;">최고 관리자</span>` : `<button class="revoke-btn" onclick="revokeUser('${uid}', '${safeName}')">해제</button>`;
                li.innerHTML = `<span>${user.displayName} <small style="color: var(--text-muted); font-weight: normal;">(${user.email})</small></span>${actionBtn}`;
                memberListEl.appendChild(li); memberCount++;
            }
        });
        if (pendingCount === 0) approvalListEl.innerHTML = '<li>승인 대기 중인 사용자가 없습니다.</li>';
        if (memberCount === 0) memberListEl.innerHTML = '<li>현재 워크스페이스에 참여 중인 멤버가 없습니다.</li>';
    });
}

async function approveUser(uid, name) {
    if (await customConfirm(`'${name}' 사용자의 수정을 허용하시겠습니까?`)) {
        db.ref('users/' + uid).update({ approved: true }).catch(async (error) => await customAlert("승인 실패: " + error.message));
    }
}

async function revokeUser(uid, name) {
    if (await customConfirm(`'${name}' 사용자의 권한을 해제하시겠습니까?`)) {
        db.ref('users/' + uid).update({ approved: false }).catch(async (error) => await customAlert("해제 실패: " + error.message));
    }
}

function openProfileModal() {
    const currentUserProfile = AppStore.getCurrentUser();
    if (!currentUserProfile) return;
    document.getElementById('profileNameInput').value = currentUserProfile.displayName || '';
    document.getElementById('profileDeptInput').value = currentUserProfile.department || 'unassigned';
    document.getElementById('profileModal').style.display = 'flex';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

async function saveProfile() {
    if (!auth.currentUser) return;
    const newName = document.getElementById('profileNameInput').value.trim();
    const newDept = document.getElementById('profileDeptInput').value;
    
    if (!newName) return await customAlert('이름을 입력해주세요.');
    
    try {
        await db.ref('users/' + auth.currentUser.uid).update({ displayName: newName, department: newDept });
        await auth.currentUser.updateProfile({ displayName: newName });
        closeProfileModal();
        showToast('개인정보가 성공적으로 수정되었습니다.', 'info');
    } catch (error) {
        console.error(error);
        await customAlert('수정 실패: ' + error.message);
    }
}