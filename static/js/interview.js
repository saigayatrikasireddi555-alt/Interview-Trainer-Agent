/**
 * interview.js
 * Full interview chat UI controller.
 * Manages messages, API calls, feedback modal, sidebar, and progress.
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  const state = {
    meta:           window.INTERVIEW_META || {},
    scores:         [],
    questionNumber: 0,
    totalQuestions: 0,
    isProcessing:   false,
    isFinished:     false,
    pendingNextMsg: null,
    feedbackQueue:  [],
  };

  // ── DOM refs ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const els = {
    chatInner:      $('chatMessagesInner'),
    messages:       $('chatMessages'),
    loadingPH:      $('loadingPlaceholder'),
    answerInput:    $('answerInput'),
    sendBtn:        $('sendBtn'),
    charCounter:    $('charCounter'),
    progressBar:    $('progressBar'),
    progressText:   $('progressText'),
    avgScore:       $('avgScore'),
    scoreTimeline:  $('scoreTimeline'),
    statusDot:      $('statusDot'),
    statusText:     $('statusText'),
    qNumDisplay:    $('qNumDisplay'),
    qTotalDisplay:  $('qTotalDisplay'),
    metaDomain:     $('metaDomain'),
    metaType:       $('metaType'),
    metaDifficulty: $('metaDifficulty'),
    metaExperience: $('metaExperience'),
    metaRole:       $('metaRole'),
    endEarlyBtn:    $('endEarlyBtn'),
    confirmEndBtn:  $('confirmEndBtn'),
    sidebarToggle:  $('sidebarToggle'),
    sidebarClose:   $('sidebarClose'),
    sidebar:        $('interviewSidebar'),
    feedbackModal:  new bootstrap.Modal($('feedbackModal'), { backdrop: 'static' }),
    endEarlyModal:  new bootstrap.Modal($('endEarlyModal')),
    feedbackBody:   $('feedbackModalBody'),
    modalNextBtn:   $('modalNextBtn'),
  };

  // ── Init ───────────────────────────────────────────────────
  function init() {
    populateSidebar();
    wireEvents();

    // Check for first message from sessionStorage (set by index.html)
    const firstRaw = sessionStorage.getItem('firstMessage');
    if (firstRaw) {
      sessionStorage.removeItem('firstMessage');
      try {
        const first = JSON.parse(firstRaw);
        hidePlaceholder();
        state.questionNumber = 1;
        state.totalQuestions = first.total;
        updateProgress(1, first.total);
        appendBotMessage(first.message);
        enableInput();
        setStatus('online', 'Ready');
      } catch (e) {
        showError('Session data corrupted. Please start a new interview.');
      }
    } else {
      // No session data — redirect home
      setTimeout(() => {
        showToast('No active session found. Redirecting…', 'warning');
        setTimeout(() => window.location.href = '/', 2000);
      }, 500);
    }
  }

  // ── Sidebar meta population ────────────────────────────────
  function populateSidebar() {
    const m = state.meta;
    if (!m) return;
    setText('metaDomain',     (m.domain || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    setText('metaType',       (m.interview_type || '—').replace(/\b\w/g, c => c.toUpperCase()));
    setText('metaExperience', (m.experience || '—').replace(/\b\w/g, c => c.toUpperCase()));
    setText('metaRole',       m.role || '—');
    // Difficulty badge
    if (els.metaDifficulty) {
      els.metaDifficulty.textContent = (m.difficulty || '—').replace(/\b\w/g, c => c.toUpperCase());
      els.metaDifficulty.className = `meta-value difficulty-badge difficulty-${m.difficulty || 'medium'}`;
    }
  }

  function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = val;
  }

  // ── Event wiring ───────────────────────────────────────────
  function wireEvents() {
    // Send on Enter (not Shift+Enter)
    els.answerInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitAnswer();
      }
    });
    els.answerInput.addEventListener('input', () => {
      const len = els.answerInput.value.length;
      if (els.charCounter) els.charCounter.textContent = `${len} char${len !== 1 ? 's' : ''}`;
    });

    els.sendBtn.addEventListener('click', submitAnswer);

    els.endEarlyBtn?.addEventListener('click', () => els.endEarlyModal.show());
    els.confirmEndBtn?.addEventListener('click', endEarly);

    els.sidebarToggle?.addEventListener('click', () => els.sidebar?.classList.toggle('open'));
    els.sidebarClose?.addEventListener('click',  () => els.sidebar?.classList.remove('open'));

  }

  // ── Submit answer ──────────────────────────────────────────
  async function submitAnswer() {
    if (state.isProcessing || state.isFinished) return;
    const text = els.answerInput.value.trim();
    if (!text) {
      showToast('Please type your answer before submitting.', 'warning');
      return;
    }

    appendUserMessage(text);
    disableInput();
    els.answerInput.value = '';
    if (els.charCounter) els.charCounter.textContent = '0 chars';
    setStatus('thinking', 'Evaluating…');
    showTypingIndicator();
    state.isProcessing = true;

    try {
      const res  = await fetch('/api/answer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ answer: text }),
      });
      const data = await res.json();

      removeTypingIndicator();

      if (!res.ok) throw new Error(data.error || 'Server error');

      const evaluation = data.evaluation;
      updateScores(evaluation.score, data.question_number);

      // Build and show feedback modal
      showFeedbackModal(evaluation, () => {
        if (data.is_last) {
          state.isFinished = true;
          setStatus('offline', 'Interview complete');
          showToast('Interview complete! Generating your report…', 'success');
          setTimeout(() => window.location.href = data.redirect_url, 1200);
        } else if (data.next_question) {
          state.pendingNextMsg = data.next_question;
          if (!data.is_follow_up) {
            state.questionNumber = data.question_number + 1;
            updateProgress(state.questionNumber, state.totalQuestions);
          }
        }
      });

    } catch (err) {
      removeTypingIndicator();
      setStatus('online', 'Ready');
      showToast(err.message, 'danger');
      enableInput();
    } finally {
      state.isProcessing = false;
    }
  }

  // ── End Early ──────────────────────────────────────────────
  async function endEarly() {
    els.endEarlyModal.hide();
    setStatus('thinking', 'Generating report…');
    try {
      const res  = await fetch('/api/end', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to end interview');
      window.location.href = data.redirect_url;
    } catch (err) {
      showToast(err.message, 'danger');
      setStatus('online', 'Ready');
    }
  }

  // ── Message rendering ──────────────────────────────────────
  function appendBotMessage(text) {
    const now  = new Date().toISOString();
    const row  = document.createElement('div');
    row.className = 'message-row';
    row.innerHTML = `
      <div class="message-avatar avatar-bot" title="AI Interviewer">
        <i class="bi bi-robot"></i>
      </div>
      <div>
        <div class="message-bubble bubble-bot">${formatMessageText(text)}</div>
        <div class="message-time">${formatTime(now)}</div>
      </div>`;
    appendMessage(row);
  }

  function appendUserMessage(text) {
    const now = new Date().toISOString();
    const row = document.createElement('div');
    row.className = 'message-row user';
    row.innerHTML = `
      <div class="message-avatar avatar-user" title="You">
        <i class="bi bi-person-fill"></i>
      </div>
      <div>
        <div class="message-bubble bubble-user">${escapeHtml(text)}</div>
        <div class="message-time">${formatTime(now)}</div>
      </div>`;
    appendMessage(row);
  }

  function appendMessage(el) {
    els.loadingPH?.remove();
    els.chatInner.appendChild(el);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const ind = document.createElement('div');
    ind.className = 'message-row';
    ind.id = 'typingIndicator';
    ind.innerHTML = `
      <div class="message-avatar avatar-bot"><i class="bi bi-robot"></i></div>
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>`;
    els.chatInner.appendChild(ind);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
  }

  // ── Feedback Modal ─────────────────────────────────────────
  function showFeedbackModal(ev, onDismiss) {
    const score   = ev.score ?? 5;
    const ringCls = score >= 8 ? 'score-excellent' : score >= 6 ? 'score-good' : score >= 4 ? 'score-average' : 'score-poor';

    const strengths = (ev.strengths || []).map(s =>
      `<li class="feedback-item feedback-strength"><i class="bi bi-check-circle-fill"></i>${escapeHtml(s)}</li>`
    ).join('');
    const weaknesses = (ev.weaknesses || []).map(w =>
      `<li class="feedback-item feedback-weakness"><i class="bi bi-x-circle-fill"></i>${escapeHtml(w)}</li>`
    ).join('');

    els.feedbackBody.innerHTML = `
      <div class="score-ring-wrap">
        <div class="score-ring ${ringCls}">
          <span>${score}</span>
          <span class="score-ring-sub">/10</span>
        </div>
        <div>
          <div class="fw-semibold fs-5">${scoreLabel(score)}</div>
          <div class="text-muted small">Answer Evaluation</div>
        </div>
      </div>

      <div class="feedback-metrics">
        <div class="feedback-metric">
          <div class="feedback-metric-label">Accuracy</div>
          <div class="feedback-metric-value">${ev.technical_accuracy ?? score}</div>
        </div>
        <div class="feedback-metric">
          <div class="feedback-metric-label">Depth</div>
          <div class="feedback-metric-value">${ev.depth ?? score}</div>
        </div>
        <div class="feedback-metric">
          <div class="feedback-metric-label">Clarity</div>
          <div class="feedback-metric-value">${ev.clarity ?? score}</div>
        </div>
      </div>

      ${strengths ? `<div class="feedback-section">
        <div class="feedback-section-title">Strengths</div>
        <ul class="feedback-list">${strengths}</ul>
      </div>` : ''}

      ${weaknesses ? `<div class="feedback-section">
        <div class="feedback-section-title">Areas to Improve</div>
        <ul class="feedback-list">${weaknesses}</ul>
      </div>` : ''}

      ${ev.ideal_answer ? `<div class="feedback-section">
        <div class="feedback-section-title">Ideal Answer</div>
        <div class="ideal-answer-box">${escapeHtml(ev.ideal_answer)}</div>
      </div>` : ''}

      ${ev.encouragement ? `<div class="encouragement-box">
        <i class="bi bi-stars me-2"></i>${escapeHtml(ev.encouragement)}
      </div>` : ''}
    `;

    // Wire modal dismiss to callback — single handler, fires once
    $('feedbackModal').addEventListener('hidden.bs.modal', function handler() {
      $('feedbackModal').removeEventListener('hidden.bs.modal', handler);
      onDismiss();
      // Deliver next question if queued
      if (state.pendingNextMsg) {
        const msg = state.pendingNextMsg;
        state.pendingNextMsg = null;
        appendBotMessage(msg);
        enableInput();
        setStatus('online', 'Ready');
      }
    });

    els.feedbackModal.show();
  }

  function scoreLabel(s) {
    if (s >= 9) return 'Outstanding!';
    if (s >= 8) return 'Excellent';
    if (s >= 6) return 'Good';
    if (s >= 4) return 'Average';
    if (s >= 2) return 'Needs Improvement';
    return 'Incorrect';
  }

  // ── Progress & Score Timeline ──────────────────────────────
  function updateProgress(current, total) {
    const pct = total > 0 ? Math.round((current - 1) / total * 100) : 0;
    if (els.progressBar) {
      els.progressBar.style.width = pct + '%';
      els.progressBar.setAttribute('aria-valuenow', pct);
    }
    if (els.progressText) els.progressText.textContent = `${current - 1} / ${total}`;
    if (els.qNumDisplay)  els.qNumDisplay.textContent  = current;
    if (els.qTotalDisplay) els.qTotalDisplay.textContent = total;
  }

  function updateScores(score, qNum) {
    state.scores.push(score);
    const avg = (state.scores.reduce((a, b) => a + b, 0) / state.scores.length).toFixed(1);
    if (els.avgScore) els.avgScore.textContent = `${avg}/10`;

    // Score dot in timeline
    if (els.scoreTimeline) {
      if (state.scores.length === 1) els.scoreTimeline.innerHTML = '';
      const dot = document.createElement('div');
      const col  = score >= 8 ? '#22c55e' : score >= 6 ? '#3b6ef7' : score >= 4 ? '#f59e0b' : '#ef4444';
      dot.className = 'score-dot';
      dot.style.background = col;
      dot.title = `Q${qNum}: ${score}/10`;
      dot.textContent = score;
      els.scoreTimeline.appendChild(dot);
    }

    updateProgress(qNum + 1, state.totalQuestions);
  }

  // ── Helpers ────────────────────────────────────────────────
  function hidePlaceholder() { els.loadingPH?.remove(); }
  function scrollToBottom()  { els.messages.scrollTop = els.messages.scrollHeight; }
  function enableInput()  { els.answerInput.disabled = false; els.sendBtn.disabled  = false; els.answerInput.focus(); }
  function disableInput() { els.answerInput.disabled = true;  els.sendBtn.disabled  = true; }

  function setStatus(state, label) {
    if (els.statusDot) {
      els.statusDot.className = `status-dot ${state}`;
    }
    if (els.statusText) els.statusText.textContent = label;
  }

  function showError(msg) {
    hidePlaceholder();
    const div = document.createElement('div');
    div.className = 'alert alert-danger m-3';
    div.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${escapeHtml(msg)}`;
    els.chatInner.appendChild(div);
  }

  /**
   * Convert plain text (with newlines) to safe HTML.
   * Bold **word** patterns, convert newlines to <br>.
   */
  function formatMessageText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ── Boot ───────────────────────────────────────────────────
  // Wait for DOM ready (this script is deferred via block)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
