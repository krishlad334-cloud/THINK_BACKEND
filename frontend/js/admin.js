(function () {
  const api = window.OverThinkAPI;

  const escapeHtml = (str = '') =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const showAlert = (el, type, message) => {
    if (!el) return;
    el.className = `alert visible ${type === 'error' ? 'alert-error' : 'alert-success'}`;
    el.textContent = message;
  };

  const clearAlert = (el) => {
    if (!el) return;
    el.className = 'alert';
    el.textContent = '';
  };

  const adminLoginSection = document.getElementById('adminLoginSection');
  const adminDashboardSection = document.getElementById('adminDashboardSection');
  const adminUserBadge = document.getElementById('adminUserBadge');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminLoginAlert = document.getElementById('adminLoginAlert');
  const adminLoginBtn = document.getElementById('adminLoginBtn');

  const filterStatus = document.getElementById('filterStatus');
  const filterCategory = document.getElementById('filterCategory');
  const filterSearch = document.getElementById('filterSearch');
  const refreshQueueBtn = document.getElementById('refreshQueueBtn');
  const dashboardAlert = document.getElementById('dashboardAlert');
  const thoughtsQueue = document.getElementById('thoughtsQueue');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const paginationInfo = document.getElementById('paginationInfo');

  let currentPage = 1;
  let totalPages = 1;

  const renderThoughts = (thoughts) => {
    if (!thoughts.length) {
      thoughtsQueue.innerHTML = '<div class="card"><p class="muted">No thoughts match your current filters.</p></div>';
      return;
    }

    thoughtsQueue.innerHTML = thoughts
      .map((thought) => {
        const replies = (thought.replies || [])
          .map(
            (r) => `
              <div class="reply-box">
                <div class="reply-header">${escapeHtml(r.responderName || r.responderType)} • ${new Date(r.createdAt).toLocaleString()}</div>
                <div style="white-space: pre-wrap;">${escapeHtml(r.message)}</div>
              </div>
            `
          )
          .join('');

        return `
          <article class="card" data-thought-id="${escapeHtml(thought._id)}">
            <div class="card-header">
              <div>
                <div class="badges" style="margin-bottom: 6px;">
                  <span class="badge badge-${escapeHtml(thought.status)}">${escapeHtml(thought.status)}</span>
                  <span class="badge badge-category">${escapeHtml(thought.category)}</span>
                  <span class="badge badge-closed">Solver: ${escapeHtml(thought.solverType || 'human')}</span>
                </div>
                <strong>${escapeHtml(thought.name)}</strong>
                <span class="muted">(${escapeHtml(thought.email)}) • ${new Date(thought.createdAt).toLocaleString()}</span>
              </div>

              <select class="status-select" data-id="${escapeHtml(thought._id)}" aria-label="Change thought status" style="padding: 6px 10px; border-radius: 8px; background:#0e0b1f; color:#f5f3ff; border:1px solid rgba(255,255,255,0.16);">
                ${['pending', 'accepted', 'in_progress', 'answered', 'resolved', 'closed']
                  .map(
                    (s) =>
                      `<option value="${s}" ${thought.status === s ? 'selected' : ''}>${s}</option>`
                  )
                  .join('')}
              </select>
            </div>

            ${thought.title ? `<h3 style="font-size: 1.05rem; margin-bottom: 6px;">${escapeHtml(thought.title)}</h3>` : ''}
            <p style="white-space: pre-wrap; margin-bottom: 12px;">${escapeHtml(thought.message)}</p>

            ${replies}

            <form class="reply-form" data-id="${escapeHtml(thought._id)}" style="margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);">
              <div class="form-grid" style="grid-template-columns: 180px 1fr; align-items: end; margin-bottom: 10px;">
                <div class="field" style="margin-bottom: 0;">
                  <label>Responder Type</label>
                  <select name="responderType">
                    <option value="consultant" ${thought.solverType !== 'ai' ? 'selected' : ''}>Human Consultant</option>
                    <option value="AI" ${thought.solverType === 'ai' ? 'selected' : ''}>AI Solution</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div class="field" style="margin-bottom: 0;">
                  <label>Solution Reply</label>
                  <textarea name="message" rows="3" placeholder="Write a clear, actionable solution..." required style="min-height: 76px;"></textarea>
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Send Solution &amp; Mark Answered</button>
            </form>
          </article>
        `;
      })
      .join('');
  };

  const loadThoughts = async () => {
    clearAlert(dashboardAlert);
    try {
      const res = await api.getThoughts({
        page: currentPage,
        limit: 8,
        status: filterStatus.value,
        category: filterCategory.value,
        q: filterSearch.value.trim(),
      });

      const { thoughts, pagination } = res.data;
      totalPages = pagination.totalPages || 1;
      paginationInfo.textContent = `Page ${pagination.page} of ${totalPages} (${pagination.total} total)`;
      prevPageBtn.disabled = pagination.page <= 1;
      nextPageBtn.disabled = pagination.page >= totalPages;

      renderThoughts(thoughts);
    } catch (err) {
      showAlert(dashboardAlert, 'error', err.message);
    }
  };

  const syncAdminAuth = async () => {
    if (!api.getToken()) {
      adminLoginSection.classList.remove('hidden');
      adminDashboardSection.classList.add('hidden');
      adminUserBadge.classList.add('hidden');
      adminLogoutBtn.classList.add('hidden');
      return;
    }

    try {
      const res = await api.getMe();
      const user = res.data.user;
      if (!['consultant', 'admin'].includes(user.role)) {
        throw new Error('This workspace requires a consultant or admin account.');
      }

      adminUserBadge.textContent = `${user.name} (${user.role})`;
      adminUserBadge.classList.remove('hidden');
      adminLogoutBtn.classList.remove('hidden');
      adminLoginSection.classList.add('hidden');
      adminDashboardSection.classList.remove('hidden');

      await loadThoughts();
    } catch (err) {
      api.clearSession();
      adminLoginSection.classList.remove('hidden');
      adminDashboardSection.classList.add('hidden');
      adminUserBadge.classList.add('hidden');
      adminLogoutBtn.classList.add('hidden');
      showAlert(adminLoginAlert, 'error', err.message);
    }
  };

  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(adminLoginAlert);
    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = 'Signing in...';

    try {
      const res = await api.login({
        email: document.getElementById('adminEmail').value.trim(),
        password: document.getElementById('adminPassword').value,
      });

      const user = res.data.user;
      if (!['consultant', 'admin'].includes(user.role)) {
        api.clearSession();
        throw new Error('Access denied: please sign in with a consultant or admin account.');
      }

      adminLoginForm.reset();
      await syncAdminAuth();
    } catch (err) {
      showAlert(adminLoginAlert, 'error', err.message);
    } finally {
      adminLoginBtn.disabled = false;
      adminLoginBtn.textContent = 'Sign In to Workspace';
    }
  });

  adminLogoutBtn.addEventListener('click', () => {
    api.logout();
    syncAdminAuth();
  });

  [filterStatus, filterCategory].forEach((el) => {
    el.addEventListener('change', () => {
      currentPage = 1;
      loadThoughts();
    });
  });

  let searchTimeout = null;
  filterSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadThoughts();
    }, 300);
  });

  refreshQueueBtn.addEventListener('click', loadThoughts);
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadThoughts();
    }
  });
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      loadThoughts();
    }
  });

  // Event delegation for status changes and replies
  thoughtsQueue.addEventListener('change', async (e) => {
    const select = e.target.closest('.status-select');
    if (!select) return;

    try {
      const res = await api.updateThoughtStatus(select.dataset.id, select.value);
      showAlert(dashboardAlert, 'success', res.message);
      await loadThoughts();
    } catch (err) {
      showAlert(dashboardAlert, 'error', err.message);
    }
  });

  thoughtsQueue.addEventListener('submit', async (e) => {
    const form = e.target.closest('.reply-form');
    if (!form) return;
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const messageEl = form.querySelector('textarea[name="message"]');
    const responderTypeEl = form.querySelector('select[name="responderType"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const res = await api.submitReply({
        thought: form.dataset.id,
        responderType: responderTypeEl.value,
        message: messageEl.value.trim(),
      });
      showAlert(dashboardAlert, 'success', res.message);
      await loadThoughts();
    } catch (err) {
      showAlert(dashboardAlert, 'error', err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Solution & Mark Answered';
    }
  });

  syncAdminAuth();
})();
