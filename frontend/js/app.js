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

  const setButtonLoading = (btn, isLoading, loadingText, defaultText) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? loadingText : defaultText;
  };

  const formatThoughtCard = (thought) => {
    const replies = Array.isArray(thought.replies) ? thought.replies : [];
    const replyMarkup = replies
      .map(
        (reply) => `
          <div class="reply-box">
            <div class="reply-header">
              Solution by ${escapeHtml(reply.responderName || reply.responderType || 'Consultant')}
              • ${new Date(reply.createdAt).toLocaleString()}
            </div>
            <div style="white-space: pre-wrap;">${escapeHtml(reply.message)}</div>
          </div>
        `
      )
      .join('');

    return `
      <div class="thought-item">
        <div class="thought-meta">
          <div class="badges">
            <span class="badge badge-${escapeHtml(thought.status)}">${escapeHtml(thought.status)}</span>
            <span class="badge badge-category">${escapeHtml(thought.category)}</span>
            <span class="badge badge-closed">${escapeHtml(thought.solverType || 'human')}</span>
          </div>
          <span>ID: <code>${escapeHtml(thought._id)}</code></span>
        </div>
        ${thought.title ? `<strong style="display:block; margin-bottom:4px;">${escapeHtml(thought.title)}</strong>` : ''}
        <p style="white-space: pre-wrap; font-size: 0.9rem;">${escapeHtml(thought.message)}</p>
        ${replyMarkup || '<p class="muted" style="margin-top:8px;">Awaiting consultant/AI solution...</p>'}
      </div>
    `;
  };

  // DOM references
  const healthDot = document.getElementById('healthDot');
  const healthText = document.getElementById('healthText');
  const userBadge = document.getElementById('userBadge');
  const logoutBtn = document.getElementById('logoutBtn');
  const authCard = document.getElementById('authCard');
  const myThoughtsCard = document.getElementById('myThoughtsCard');
  const myThoughtsList = document.getElementById('myThoughtsList');
  const refreshMyThoughtsBtn = document.getElementById('refreshMyThoughtsBtn');

  const thoughtForm = document.getElementById('thoughtForm');
  const thoughtAlert = document.getElementById('thoughtAlert');
  const thoughtName = document.getElementById('thoughtName');
  const thoughtEmail = document.getElementById('thoughtEmail');
  const thoughtMessage = document.getElementById('thoughtMessage');
  const charCount = document.getElementById('charCount');
  const thoughtSubmitBtn = document.getElementById('thoughtSubmitBtn');

  const authForm = document.getElementById('authForm');
  const authAlert = document.getElementById('authAlert');
  const registerFields = document.getElementById('registerFields');
  const authName = document.getElementById('authName');
  const authRole = document.getElementById('authRole');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const tabButtons = document.querySelectorAll('[data-auth-mode]');

  const trackForm = document.getElementById('trackForm');
  const trackIdInput = document.getElementById('trackIdInput');
  const trackSubmitBtn = document.getElementById('trackSubmitBtn');
  const trackAlert = document.getElementById('trackAlert');
  const trackedThoughtResult = document.getElementById('trackedThoughtResult');

  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterEmail = document.getElementById('newsletterEmail');
  const newsletterSubmitBtn = document.getElementById('newsletterSubmitBtn');
  const newsletterAlert = document.getElementById('newsletterAlert');

  let authMode = 'login';

  const checkHealth = async () => {
    try {
      const res = await api.healthCheck();
      const dbOk = res.data?.database === 'connected';
      healthDot.className = `dot ${dbOk ? 'online' : 'offline'}`;
      healthText.textContent = dbOk ? 'API & MongoDB Connected' : 'API Up (DB Disconnected)';
    } catch (_err) {
      healthDot.className = 'dot offline';
      healthText.textContent = 'Backend Offline';
    }
  };

  const loadMyThoughts = async () => {
    if (!api.getToken()) return;
    try {
      const res = await api.getMyThoughts();
      const list = res.data?.thoughts || [];
      myThoughtsList.innerHTML = list.length
        ? list.map(formatThoughtCard).join('')
        : '<p class="muted">You have not submitted any thoughts yet.</p>';
    } catch (err) {
      myThoughtsList.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    }
  };

  const syncAuthUI = async () => {
    const token = api.getToken();
    if (!token) {
      userBadge.classList.add('hidden');
      logoutBtn.classList.add('hidden');
      authCard.classList.remove('hidden');
      myThoughtsCard.classList.add('hidden');
      return;
    }

    try {
      const res = await api.getMe();
      const user = res.data.user;
      api.setSession(token, user);

      userBadge.textContent = `${user.name} (${user.role})`;
      userBadge.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
      authCard.classList.add('hidden');
      myThoughtsCard.classList.remove('hidden');

      if (!thoughtName.value) thoughtName.value = user.name || '';
      if (!thoughtEmail.value) thoughtEmail.value = user.email || '';

      await loadMyThoughts();
    } catch (_err) {
      api.clearSession();
      userBadge.classList.add('hidden');
      logoutBtn.classList.add('hidden');
      authCard.classList.remove('hidden');
      myThoughtsCard.classList.add('hidden');
    }
  };

  // Switch between Sign In & Register
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      authMode = btn.dataset.authMode;
      tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      registerFields.classList.toggle('hidden', authMode === 'login');
      authName.required = authMode === 'register';
      authSubmitBtn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
      clearAlert(authAlert);
    });
  });

  // Live character counter
  thoughtMessage.addEventListener('input', () => {
    charCount.textContent = `${thoughtMessage.value.length} / 3000`;
  });

  // Thought submission form
  thoughtForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(thoughtAlert);
    setButtonLoading(thoughtSubmitBtn, true, 'Submitting...', 'Submit Thought');

    const selectedSolver = thoughtForm.querySelector('input[name="solverType"]:checked')?.value || 'human';

    try {
      const res = await api.submitThought({
        name: thoughtName.value.trim(),
        email: thoughtEmail.value.trim(),
        title: document.getElementById('thoughtTitle').value.trim(),
        category: document.getElementById('thoughtCategory').value,
        solverType: selectedSolver,
        message: thoughtMessage.value.trim(),
      });

      const created = res.data?.thought;
      showAlert(
        thoughtAlert,
        'success',
        `${res.message} Tracking ID: ${created?._id || ''}`
      );
      if (created?._id) {
        trackIdInput.value = created._id;
        trackedThoughtResult.innerHTML = formatThoughtCard(created);
      }

      thoughtForm.reset();
      charCount.textContent = '0 / 3000';

      const currentUser = api.getStoredUser();
      if (currentUser) {
        thoughtName.value = currentUser.name || '';
        thoughtEmail.value = currentUser.email || '';
        await loadMyThoughts();
      }
    } catch (err) {
      showAlert(thoughtAlert, 'error', err.message);
    } finally {
      setButtonLoading(thoughtSubmitBtn, false, 'Submitting...', 'Submit Thought');
    }
  });

  // Auth login / register form
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(authAlert);
    const defaultLabel = authMode === 'login' ? 'Sign In' : 'Create Account';
    setButtonLoading(authSubmitBtn, true, 'Please wait...', defaultLabel);

    try {
      if (authMode === 'register') {
        const res = await api.register({
          name: authName.value.trim(),
          email: authEmail.value.trim(),
          password: authPassword.value,
          role: authRole.value,
        });
        showAlert(authAlert, 'success', res.message);
      } else {
        const res = await api.login({
          email: authEmail.value.trim(),
          password: authPassword.value,
        });
        showAlert(authAlert, 'success', res.message);
      }

      authForm.reset();
      await syncAuthUI();
    } catch (err) {
      showAlert(authAlert, 'error', err.message);
    } finally {
      setButtonLoading(authSubmitBtn, false, 'Please wait...', defaultLabel);
    }
  });

  logoutBtn.addEventListener('click', () => {
    api.logout();
    syncAuthUI();
  });

  refreshMyThoughtsBtn.addEventListener('click', loadMyThoughts);

  // Track Thought by ID
  trackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(trackAlert);
    setButtonLoading(trackSubmitBtn, true, 'Checking...', 'Check');

    try {
      const res = await api.getThoughtById(trackIdInput.value.trim());
      trackedThoughtResult.innerHTML = formatThoughtCard(res.data.thought);
    } catch (err) {
      trackedThoughtResult.innerHTML = '';
      showAlert(trackAlert, 'error', err.message);
    } finally {
      setButtonLoading(trackSubmitBtn, false, 'Checking...', 'Check');
    }
  });

  // Newsletter form
  newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(newsletterAlert);
    setButtonLoading(newsletterSubmitBtn, true, 'Subscribing...', 'Subscribe');

    try {
      const res = await api.subscribeNewsletter({
        email: newsletterEmail.value.trim(),
        source: 'footer_newsletter',
      });
      showAlert(newsletterAlert, 'success', res.message);
      newsletterForm.reset();
    } catch (err) {
      showAlert(newsletterAlert, 'error', err.message);
    } finally {
      setButtonLoading(newsletterSubmitBtn, false, 'Subscribing...', 'Subscribe');
    }
  });

  checkHealth();
  syncAuthUI();
})();
