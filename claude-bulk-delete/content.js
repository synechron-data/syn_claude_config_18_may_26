/* ============================================================
   FILE: content.js
   Claude Bulk Delete — Content Script (Manifest V3)
   Self-invoking IIFE, zero external dependencies.
   ============================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     GUARD: Prevent double-injection if the script somehow
     runs more than once in the same page context.
  ───────────────────────────────────────────────────────── */
  if (window.__cbdLoaded) return;
  window.__cbdLoaded = true;

  /* ─────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────── */
  let bulkModeActive  = false;   // Is bulk-select mode on?
  let selectedIds     = new Set(); // UUIDs of selected conversations
  let orgId           = null;    // Cached org UUID from /api/organizations
  let observer        = null;    // MutationObserver for sidebar re-renders
  let deleteInProgress = false;  // Guard against double-clicks on Delete btn

  /* ─────────────────────────────────────────────────────────
     LOGGING — all logs prefixed [CBD] so they're easy to
     grep in DevTools console when troubleshooting DOM issues.
  ───────────────────────────────────────────────────────── */
  const log  = (...a) => console.log('[CBD]', ...a);
  const warn = (...a) => console.warn('[CBD]', ...a);

  /* ══════════════════════════════════════════════════════════
     SECTION 1 — ORG-ID PRE-FETCH
     We fetch the org UUID immediately when bulk mode activates
     (not when Delete is clicked) so the user never waits.
  ══════════════════════════════════════════════════════════ */
  async function fetchOrgId() {
    if (orgId) return orgId; // already cached
    try {
      const res  = await fetch('/api/organizations', { credentials: 'include' });
      const orgs = await res.json();
      orgId = orgs[0]?.uuid;
      if (!orgId) throw new Error('No org UUID in response');
      log('orgId fetched:', orgId);
      return orgId;
    } catch (err) {
      warn('Failed to fetch orgId:', err);
      showToast('❌ Could not fetch org info. Deletions aborted.', 'error');
      return null;
    }
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 2 — DOM HELPERS
  ══════════════════════════════════════════════════════════ */

  /**
   * Extract the conversation UUID from the <a> href attribute.
   * claude.ai uses paths like /chat/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  function convIdFromLink(a) {
    return (a.getAttribute('href') || '').split('/').pop() || null;
  }

  /**
   * DOM STRUCTURE (verified, do not assume):
   *
   *   <li>
   *     <div>                   ← ROW WRAPPER (direct child of <li>)
   *       <a href="/chat/UUID"> ← conversation link (child of div, NOT <li>)
   *     </div>
   *   </li>
   *
   * WHY we walk up with parentElement instead of using .closest():
   * We need the DIRECT child of <li>, which is the row wrapper <div>.
   * .closest('li') would give us the <li> itself. Instead we walk:
   *   a → parentElement → ... until parentElement === <li>
   * That gives us the element whose parentElement is <li>, i.e. the
   * row wrapper. We apply display:flex there, not on the <li>,
   * because styling the <li> would break the sidebar's own layout.
   */
  function getRowWrapper(a) {
    let el = a;
    while (el && el.parentElement && el.parentElement.tagName !== 'LI') {
      el = el.parentElement;
    }
    return el; // direct child of <li>
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 3 — CHECKBOX INJECTION (idempotent)

     Guards that make this safe to call on every MutationObserver
     fire without duplicating checkboxes:
       1. link.dataset.cbdDone — set after first injection
       2. rowWrapper.querySelector('.cbd-check-col') — DOM check
     Both guards together ensure zero duplicates.
  ══════════════════════════════════════════════════════════ */
  function injectCheckboxes() {
    /* Select all conversation links in the sidebar.
       claude.ai uses <a href="/chat/UUID"> as the link pattern. */
    const links = document.querySelectorAll('a[href^="/chat/"]');

    links.forEach(link => {
      /* Guard 1: data attribute — fastest check */
      if (link.dataset.cbdDone) return;

      const convId = convIdFromLink(link);
      if (!convId) return;

      /* Guard 2: DOM presence check */
      const rowWrapper = getRowWrapper(link);
      if (!rowWrapper) return;
      if (rowWrapper.querySelector('.cbd-check-col')) return;

      /* ── Build the checkbox column ─────────────────────── */
      const col = document.createElement('label');
      col.className = 'cbd-check-col';
      col.setAttribute('aria-label', 'Select conversation');

      /* Hidden real checkbox — driven by CSS */
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cbd-cb';
      cb.dataset.convId = convId;

      /* Visual checkmark element — styled via CSS sibling selector */
      const mark = document.createElement('span');
      mark.className = 'cbd-mark';

      col.appendChild(cb);
      col.appendChild(mark);

      /* Restore checked state if this row was selected before re-render */
      if (selectedIds.has(convId)) cb.checked = true;

      /* Checkbox change handler */
      cb.addEventListener('change', () => {
        toggleRow(convId, cb.checked, link.closest('li'));
      });

      /* ── Apply flex to ROW WRAPPER, not the <li> ────────
         WHY: The sidebar's own <li> layout must not be disrupted.
         We only flex the inner wrapper div so our checkbox sits
         to the left of the existing content without collapsing it.
      ─────────────────────────────────────────────────────── */
      rowWrapper.style.display = 'flex';
      rowWrapper.style.alignItems = 'center';

      /* CRITICAL: insertBefore requires a reference node that IS
         a direct child of rowWrapper. We use rowWrapper.firstChild.
         Using any non-direct-child reference throws a silent DOM
         exception and no checkboxes appear. */
      rowWrapper.insertBefore(col, rowWrapper.firstChild);

      /* ── Capture-phase click blocker on the <a> ─────────
         In select mode, clicking the link row should toggle the
         checkbox, NOT navigate. We use capture phase (3rd arg = true)
         because React's own click handlers bubble up — capture fires
         first, giving us the chance to call stopImmediatePropagation
         before any React handler sees the event.
      ─────────────────────────────────────────────────────── */
      link.addEventListener('click', (e) => {
        if (!bulkModeActive) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const newState = !selectedIds.has(convId);
        cb.checked = newState;
        toggleRow(convId, newState, link.closest('li'));
      }, true /* capture phase */);

      /* Mark done so we never double-inject */
      link.dataset.cbdDone = '1';
    });
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 4 — ROW SELECTION TOGGLE
  ══════════════════════════════════════════════════════════ */
  function toggleRow(convId, checked, liEl) {
    if (checked) {
      selectedIds.add(convId);
    } else {
      selectedIds.delete(convId);
    }
    if (liEl) {
      liEl.classList.toggle('cbd-selected', checked);
    }
    updateToolbar();
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 5 — BULK MODE ACTIVATION / DEACTIVATION
  ══════════════════════════════════════════════════════════ */
  function activateBulkMode() {
    bulkModeActive = true;
    toggleBtn.classList.add('cbd-active');
    toggleBtn.textContent = '✕ Exit Select';
    toolbar.classList.add('cbd-visible');

    /* Show checkbox column on all rows */
    document.querySelectorAll('.cbd-check-col').forEach(el => {
      el.style.display = 'flex';
    });

    /* Start observing for sidebar re-renders / lazy-loaded rows */
    startObserver();

    /* Inject immediately for existing rows */
    injectCheckboxes();

    /* Pre-fetch orgId in background so delete doesn't wait */
    fetchOrgId();

    updateToolbar();
    log('Bulk mode activated');
  }

  function deactivateBulkMode() {
    bulkModeActive = false;
    toggleBtn.classList.remove('cbd-active');
    toggleBtn.textContent = '☑ Bulk Select';
    toolbar.classList.remove('cbd-visible');

    /* Hide checkbox column without removing from DOM
       (so idempotency guards still work on re-activation) */
    document.querySelectorAll('.cbd-check-col').forEach(el => {
      el.style.display = 'none';
    });

    /* Clear all selected states */
    selectedIds.clear();
    document.querySelectorAll('.cbd-selected').forEach(el => {
      el.classList.remove('cbd-selected');
    });
    document.querySelectorAll('.cbd-cb').forEach(cb => {
      cb.checked = false;
    });

    stopObserver();
    updateToolbar();
    log('Bulk mode deactivated');
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 6 — MUTATION OBSERVER
     Watches for sidebar re-renders (React re-mounts conversation
     list, infinite scroll loads more) and re-injects checkboxes.
  ══════════════════════════════════════════════════════════ */
  function startObserver() {
    if (observer) return; // already running
    observer = new MutationObserver(() => {
      if (bulkModeActive) injectCheckboxes();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    log('MutationObserver started');
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
      log('MutationObserver stopped');
    }
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 7 — TOOLBAR UPDATE
  ══════════════════════════════════════════════════════════ */
  function updateToolbar() {
    const n = selectedIds.size;
    countLabel.textContent = n > 0 ? `${n} chat${n > 1 ? 's' : ''} selected` : 'Click chats to select';
    deleteBtn.textContent  = n > 0 ? `🗑 Delete ${n}` : '🗑 Delete';
    deleteBtn.disabled     = n === 0 || deleteInProgress;
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 8 — SELECT ALL / CLEAR ALL
  ══════════════════════════════════════════════════════════ */
  function selectAll() {
    document.querySelectorAll('a[href^="/chat/"]').forEach(link => {
      const convId = convIdFromLink(link);
      if (!convId) return;
      selectedIds.add(convId);
      const cb = link.closest('li')?.querySelector('.cbd-cb');
      if (cb) cb.checked = true;
      const li = link.closest('li');
      if (li) li.classList.add('cbd-selected');
    });
    updateToolbar();
  }

  function clearAll() {
    selectedIds.clear();
    document.querySelectorAll('.cbd-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.cbd-selected').forEach(li => li.classList.remove('cbd-selected'));
    updateToolbar();
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 9 — DELETE FLOW

     Step 1: GET /api/organizations → extract orgs[0].uuid (orgId)
     Step 2: DELETE /api/organizations/{orgId}/chat_conversations/{convId}
     Fallback: PATCH same URL with { is_archived: true }

     WHY location.href = '/' instead of location.reload():
       claude.ai is a React SPA that uses React Query for data fetching.
       React Query caches the conversation list in memory. When you call
       location.reload(), the page rehydrates from this cache — deleted
       conversations REAPPEAR because the cache still contains them.
       Using location.href = '/' forces a full browser navigation,
       which tears down the entire React tree and discards the cache
       completely. The page then fetches fresh data from the server.

     WHY 3000ms delay before navigation:
       Deletions are sequential with 400ms throttle. The server needs
       time to propagate all deletes before the sidebar re-fetches.
       3000ms gives a comfortable buffer. If deletions still reappear,
       increase this to 5000ms.
  ══════════════════════════════════════════════════════════ */
  async function runDelete() {
    if (deleteInProgress) return;

    const ids = [...selectedIds];
    const n   = ids.length;
    if (n === 0) return;

    /* Confirm dialog */
    const confirmed = confirm(`Delete ${n} chat${n > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;

    deleteInProgress = true;
    deleteBtn.disabled = true;

    /* Fetch orgId (uses cached value if already fetched) */
    const oid = await fetchOrgId();
    if (!oid) {
      /* fetchOrgId already showed an error toast */
      deleteInProgress = false;
      deleteBtn.disabled = false;
      return;
    }

    let successCount = 0;
    let errorCount   = 0;

    for (let i = 0; i < ids.length; i++) {
      const convId = ids[i];

      /* Live progress counter in button */
      deleteBtn.textContent = `Deleting… ${i + 1}/${n}`;

      /* Fade the row visually */
      const link = document.querySelector(`a[href="/chat/${convId}"]`);
      const li   = link?.closest('li');
      if (li) li.style.opacity = '0.2';

      try {
        const url = `/api/organizations/${oid}/chat_conversations/${convId}`;

        /* Primary: DELETE request */
        let res = await fetch(url, {
          method: 'DELETE',
          credentials: 'include'
        });

        /* Fallback: if DELETE fails, archive instead */
        if (!res.ok) {
          warn(`DELETE failed for ${convId} (${res.status}), trying PATCH archive`);
          res = await fetch(url, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_archived: true })
          });
        }

        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
          warn(`Both DELETE and PATCH failed for ${convId}`);
          if (li) li.style.opacity = '1'; // restore if failed
        }
      } catch (err) {
        errorCount++;
        warn(`Network error for ${convId}:`, err);
        if (li) li.style.opacity = '1';
      }

      /* Throttle: minimum 400ms between API calls to avoid rate limiting */
      if (i < ids.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    /* Show result toast */
    if (errorCount === 0) {
      showToast(`✅ Deleted ${successCount} conversation${successCount > 1 ? 's' : ''}. Refreshing…`, 'success');
    } else {
      showToast(`⚠️ Done: ${successCount} deleted, ${errorCount} failed. Refreshing…`, 'warn');
    }

    deleteInProgress = false;

    /* WHY location.href = '/' and not location.reload():
       See the block comment above in SECTION 9. */
    setTimeout(() => {
      location.href = '/';
    }, 3000);
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 10 — TOAST NOTIFICATIONS
  ══════════════════════════════════════════════════════════ */
  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `cbd-toast cbd-toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    /* Animate in */
    requestAnimationFrame(() => toast.classList.add('cbd-toast-show'));

    /* Auto-remove after 4s */
    setTimeout(() => {
      toast.classList.remove('cbd-toast-show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  /* ══════════════════════════════════════════════════════════
     SECTION 11 — BUILD UI ELEMENTS
  ══════════════════════════════════════════════════════════ */

  /* ── Toggle Button ─────────────────────────────────────── */
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'cbd-toggle';
  toggleBtn.className = 'cbd-toggle';
  toggleBtn.textContent = '☑ Bulk Select';
  toggleBtn.setAttribute('aria-label', 'Toggle bulk select mode');

  toggleBtn.addEventListener('click', () => {
    bulkModeActive ? deactivateBulkMode() : activateBulkMode();
  });

  /* ── Toolbar ───────────────────────────────────────────── */
  const toolbar = document.createElement('div');
  toolbar.id = 'cbd-toolbar';
  toolbar.className = 'cbd-toolbar';

  /* Count label */
  const countLabel = document.createElement('span');
  countLabel.className = 'cbd-count';
  countLabel.textContent = 'Click chats to select';

  /* Button row */
  const btnRow = document.createElement('div');
  btnRow.className = 'cbd-btn-row';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'cbd-btn cbd-btn-secondary';
  selectAllBtn.textContent = '✓ All';
  selectAllBtn.addEventListener('click', selectAll);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'cbd-btn cbd-btn-secondary';
  clearBtn.textContent = '✕ Clear';
  clearBtn.addEventListener('click', clearAll);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'cbd-btn cbd-btn-danger';
  deleteBtn.textContent = '🗑 Delete';
  deleteBtn.disabled = true;
  deleteBtn.addEventListener('click', runDelete);

  btnRow.appendChild(selectAllBtn);
  btnRow.appendChild(clearBtn);
  btnRow.appendChild(deleteBtn);

  toolbar.appendChild(countLabel);
  toolbar.appendChild(btnRow);

  /* ── Mount to DOM ──────────────────────────────────────── */
  document.body.appendChild(toolbar);
  document.body.appendChild(toggleBtn);

  log('Claude Bulk Delete loaded ✓');

})();
