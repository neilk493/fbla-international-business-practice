(() => {
  const loader = window.FBLAIntlLoader;

  if (!loader || !Array.isArray(loader.questions) || !Array.isArray(loader.banks)) {
    document.body.innerHTML = "<p style=\"padding:24px;font-family:sans-serif;\">The compiled question bank did not load correctly.</p>";
    return;
  }

  const STORAGE_KEY = "fbla-intl-practice-state-v1";
  const MAX_RECENT_SESSIONS = 10;
  const OFFICIAL_SIMULATION_MIN_CONFIDENCE = 2;
  const MODE_LABELS = {
    simulation: "Official Simulation",
    bank: "Specific Bank",
    review: "Review Queue",
  };
  const SW_VERSION = "20260623-13";

  const banksById = new Map(loader.banks.map((bank) => [bank.id, bank]));
  const categoriesById = new Map((loader.categories || []).map((category) => [category.id, category]));
  const defaultBankId = loader.banks[0] ? loader.banks[0].id : "";
  const officialSimulation = loader.officialSimulation || {
    questionCount: 100,
    timerMinutes: 50,
    categoryCounts: [],
  };
  const OFFICIAL_QUESTION_TOTAL = officialSimulation.questionCount
    || officialSimulation.categoryCounts.reduce((sum, category) => sum + category.count, 0)
    || 100;
  const CATEGORY_AVAILABILITY_BY_ID = new Map(
    (loader.summary?.categorySummary || [])
      .map((category) => [category.id, category.availableQuestionCount]),
  );
  const MAX_SIMULATION_QUESTION_COUNT = getMaxSimulationQuestionCount();

  const defaultPreferences = {
    mode: "simulation",
    bankId: defaultBankId,
    questionCount: OFFICIAL_QUESTION_TOTAL,
    timerEnabled: true,
    timerMinutes: officialSimulation.timerMinutes || 50,
    feedbackMode: "immediate",
    choiceOrder: "shuffle",
  };

  const state = {
    storageEnabled: storageAvailable(),
    storage: loadStorage(),
    view: "setup",
    session: null,
    lastResult: null,
  };

  const dom = {
    setupView: document.getElementById("setupView"),
    sessionView: document.getElementById("sessionView"),
    resultsView: document.getElementById("resultsView"),
    heroStats: document.getElementById("heroStats"),
    modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
    modeNote: document.getElementById("modeNote"),
    bankField: document.getElementById("bankField"),
    bankSelect: document.getElementById("bankSelect"),
    questionCountField: document.getElementById("questionCountField"),
    questionCountInput: document.getElementById("questionCountInput"),
    timerEnabledField: document.getElementById("timerEnabledField"),
    timerEnabledInput: document.getElementById("timerEnabledInput"),
    timerMinutesField: document.getElementById("timerMinutesField"),
    timerMinutesInput: document.getElementById("timerMinutesInput"),
    feedbackModeSelect: document.getElementById("feedbackModeSelect"),
    choiceOrderSelect: document.getElementById("choiceOrderSelect"),
    setupNotice: document.getElementById("setupNotice"),
    startSessionBtn: document.getElementById("startSessionBtn"),
    resetProgressBtn: document.getElementById("resetProgressBtn"),
    overviewStats: document.getElementById("overviewStats"),
    reviewQueueSummary: document.getElementById("reviewQueueSummary"),
    reviewReasonBadges: document.getElementById("reviewReasonBadges"),
    openReviewQueueInfoBtn: document.getElementById("openReviewQueueInfoBtn"),
    officialBreakdown: document.getElementById("officialBreakdown"),
    recentSessionsList: document.getElementById("recentSessionsList"),
    sessionModeChip: document.getElementById("sessionModeChip"),
    sessionTitle: document.getElementById("sessionTitle"),
    sessionSubtitle: document.getElementById("sessionSubtitle"),
    progressValue: document.getElementById("progressValue"),
    answeredValue: document.getElementById("answeredValue"),
    reviewValue: document.getElementById("reviewValue"),
    timerDisplay: document.getElementById("timerDisplay"),
    backToSetupBtn: document.getElementById("backToSetupBtn"),
    submitSessionBtn: document.getElementById("submitSessionBtn"),
    questionPosition: document.getElementById("questionPosition"),
    questionSourceChip: document.getElementById("questionSourceChip"),
    questionCategoryChip: document.getElementById("questionCategoryChip"),
    flagBtn: document.getElementById("flagBtn"),
    flagBtnLabel: document.getElementById("flagBtnLabel"),
    questionInfoBtn: document.getElementById("questionInfoBtn"),
    questionPrompt: document.getElementById("questionPrompt"),
    answerList: document.getElementById("answerList"),
    feedbackCard: document.getElementById("feedbackCard"),
    prevQuestionBtn: document.getElementById("prevQuestionBtn"),
    nextQuestionBtn: document.getElementById("nextQuestionBtn"),
    jumpFlaggedBtn: document.getElementById("jumpFlaggedBtn"),
    sessionHint: document.getElementById("sessionHint"),
    resultsHeadline: document.getElementById("resultsHeadline"),
    resultsSubline: document.getElementById("resultsSubline"),
    resultsStats: document.getElementById("resultsStats"),
    resultsBackBtn: document.getElementById("resultsBackBtn"),
    resultsReviewRunBtn: document.getElementById("resultsReviewRunBtn"),
    resultsReviewList: document.getElementById("resultsReviewList"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalEyebrow: document.getElementById("modalEyebrow"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    closeModalBtn: document.getElementById("closeModalBtn"),
  };

  function storageAvailable() {
    try {
      const probeKey = "__fbla_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeStorage(raw) {
    const storage = raw && typeof raw === "object" ? raw : {};
    const preferences = storage.preferences && typeof storage.preferences === "object" ? storage.preferences : {};
    const questionStates = storage.questionStates && typeof storage.questionStates === "object" ? storage.questionStates : {};
    const recentSessions = Array.isArray(storage.recentSessions) ? storage.recentSessions.slice(0, MAX_RECENT_SESSIONS) : [];

    return {
      preferences: {
        ...defaultPreferences,
        ...preferences,
        bankId: banksById.has(preferences.bankId) ? preferences.bankId : defaultBankId,
      },
      questionStates,
      recentSessions,
    };
  }

  function loadStorage() {
    if (!storageAvailable()) {
      return normalizeStorage(null);
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return normalizeStorage(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeStorage(null);
    }
  }

  function saveStorage() {
    if (!state.storageEnabled) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storage));
    } catch (error) {
      console.warn("Unable to save local state.", error);
    }
  }

  function clampNumber(value, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return min;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  function getCategoryAvailability(categoryId) {
    if (CATEGORY_AVAILABILITY_BY_ID.has(categoryId)) {
      return CATEGORY_AVAILABILITY_BY_ID.get(categoryId);
    }

    const count = loader.questions.filter((question) => question.categoryId === categoryId).length;
    CATEGORY_AVAILABILITY_BY_ID.set(categoryId, count);
    return count;
  }

  function getMaxSimulationQuestionCount() {
    const weightedCaps = officialSimulation.categoryCounts
      .filter((category) => category.count > 0)
      .map((category) => Math.floor((getCategoryAvailability(category.id) * OFFICIAL_QUESTION_TOTAL) / category.count));

    if (!weightedCaps.length) {
      return loader.questions.length;
    }

    return Math.max(1, Math.min(loader.questions.length, ...weightedCaps));
  }

  function getQuestionState(questionId) {
    const existing = state.storage.questionStates[questionId];
    if (existing) {
      return existing;
    }

    const created = {
      flagged: false,
      reviewMissed: false,
      seenCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 0,
      lastOutcome: null,
      lastSeenAt: null,
      lastAnsweredAt: null,
      lastSessionMode: null,
    };
    state.storage.questionStates[questionId] = created;
    return created;
  }

  function getReviewStatus(questionId) {
    const questionState = getQuestionState(questionId);
    return {
      flagged: Boolean(questionState.flagged),
      reviewMissed: Boolean(questionState.reviewMissed),
      isReview: Boolean(questionState.flagged || questionState.reviewMissed),
    };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCategoryText(categoryId, label) {
    return `${label} (${categoryId})`;
  }

  function formatSourceText(bankShortLabel, questionNumber) {
    return `Q${questionNumber}: ${bankShortLabel}`;
  }

  function formatReviewMeta(bankShortLabel, questionNumber, categoryId, categoryLabel) {
    return `${formatSourceText(bankShortLabel, questionNumber)}, ${formatCategoryText(categoryId, categoryLabel)}`;
  }

  function formatQuestionTitle(bankShortLabel, questionNumber) {
    return `Question ${questionNumber}: ${bankShortLabel}`;
  }

  function formatDateTime(timestamp) {
    if (!timestamp) {
      return "Not yet";
    }

    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function shuffleArray(items) {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  function sortReviewQuestions(questions) {
    return [...questions].sort((left, right) => {
      const leftStatus = getReviewStatus(left.id);
      const rightStatus = getReviewStatus(right.id);
      const leftScore = (leftStatus.flagged ? 2 : 0) + (leftStatus.reviewMissed ? 1 : 0);
      const rightScore = (rightStatus.flagged ? 2 : 0) + (rightStatus.reviewMissed ? 1 : 0);
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.id.localeCompare(right.id);
    });
  }

  function getCurrentMode() {
    return MODE_LABELS[state.storage.preferences.mode] ? state.storage.preferences.mode : "simulation";
  }

  function getEffectiveSettings(overrides = {}) {
    const merged = {
      ...state.storage.preferences,
      ...overrides,
    };

    const mode = MODE_LABELS[merged.mode] ? merged.mode : "simulation";
    const bankId = banksById.has(merged.bankId) ? merged.bankId : defaultBankId;
    const feedbackMode = merged.feedbackMode === "deferred" ? "deferred" : "immediate";
    const choiceOrder = merged.choiceOrder === "fixed" ? "fixed" : "shuffle";

    return {
      mode,
      bankId,
      questionCount: clampNumber(
        merged.questionCount,
        1,
        mode === "simulation" ? MAX_SIMULATION_QUESTION_COUNT : 200,
      ),
      timerEnabled: Boolean(merged.timerEnabled),
      timerMinutes: clampNumber(merged.timerMinutes, 1, 180),
      feedbackMode,
      choiceOrder,
    };
  }

  function collectPreferencesFromControls() {
    const mode = getCurrentMode();

    return getEffectiveSettings({
      mode,
      bankId: banksById.has(dom.bankSelect.value) ? dom.bankSelect.value : defaultBankId,
      questionCount: dom.questionCountInput.value,
      timerEnabled: dom.timerEnabledInput.checked,
      timerMinutes: dom.timerMinutesInput.value,
      feedbackMode: dom.feedbackModeSelect.value,
      choiceOrder: dom.choiceOrderSelect.value,
    });
  }

  function syncControlsFromPreferences() {
    const preferences = getEffectiveSettings(state.storage.preferences);
    state.storage.preferences = preferences;

    dom.bankSelect.value = preferences.bankId;
    dom.questionCountInput.value = String(preferences.questionCount);
    dom.timerEnabledInput.checked = preferences.timerEnabled;
    dom.timerMinutesInput.value = String(preferences.timerMinutes);
    dom.feedbackModeSelect.value = preferences.feedbackMode;
    dom.choiceOrderSelect.value = preferences.choiceOrder;

    updateModeButtons(preferences.mode);
  }

  function updateModeButtons(mode) {
    dom.modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function getReviewQuestions() {
    return loader.questions.filter((question) => getReviewStatus(question.id).isReview);
  }

  function buildOverview() {
    const summary = {
      totalQuestions: loader.summary ? loader.summary.totalQuestions : loader.questions.length,
      totalBanks: loader.summary ? loader.summary.totalBanks : loader.banks.length,
      reviewCount: 0,
      flaggedCount: 0,
      missedCount: 0,
    };

    loader.questions.forEach((question) => {
      const reviewStatus = getReviewStatus(question.id);
      if (reviewStatus.isReview) summary.reviewCount += 1;
      if (reviewStatus.flagged) summary.flaggedCount += 1;
      if (reviewStatus.reviewMissed) summary.missedCount += 1;
    });

    return summary;
  }

  function renderHero() {
    const overview = buildOverview();
    const stats = [
      { label: "Official Test", value: `${officialSimulation.questionCount} in ${officialSimulation.timerMinutes} min` },
      { label: "Question Bank", value: `${overview.totalQuestions} questions` },
      { label: "Review Queue", value: `${overview.reviewCount} saved` },
    ];

    dom.heroStats.innerHTML = stats
      .map(
        (stat) => `
          <article class="hero-stat">
            <span class="label">${escapeHtml(stat.label)}</span>
            <strong>${escapeHtml(stat.value)}</strong>
          </article>
        `,
      )
      .join("");
  }

  function buildSimulationCategoryTargets(totalCount) {
    const requestedCount = clampNumber(totalCount, 1, MAX_SIMULATION_QUESTION_COUNT);
    const targets = officialSimulation.categoryCounts.map((category, index) => ({
      ...category,
      index,
      available: getCategoryAvailability(category.id),
      exact: (category.count / OFFICIAL_QUESTION_TOTAL) * requestedCount,
      count: 0,
    }));

    for (let assigned = 0; assigned < requestedCount; assigned += 1) {
      const candidate = targets
        .filter((target) => target.count < target.available)
        .sort((left, right) => {
          const leftGap = left.exact - left.count;
          const rightGap = right.exact - right.count;
          if (rightGap !== leftGap) {
            return rightGap - leftGap;
          }
          if (right.exact !== left.exact) {
            return right.exact - left.exact;
          }
          return left.index - right.index;
        })[0];

      if (!candidate) {
        throw new Error("Simulation target exceeded the available category supply.");
      }

      candidate.count += 1;
    }

    return targets.map(({ id, label, shortLabel, count }) => ({
      id,
      label,
      shortLabel,
      count,
    }));
  }

  function renderOverview(settings = getEffectiveSettings(state.storage.preferences)) {
    const overview = buildOverview();
    const stats = [
      { label: "Banks", value: overview.totalBanks },
      { label: "Review", value: overview.reviewCount },
      { label: "Flagged", value: overview.flaggedCount },
    ];

    dom.overviewStats.innerHTML = stats
      .map(
        (stat) => `
          <article class="stat-card">
            <span class="label">${escapeHtml(stat.label)}</span>
            <strong>${escapeHtml(stat.value)}</strong>
          </article>
        `,
      )
      .join("");

    const reviewSummary = [
      `${overview.reviewCount} question(s) currently in the queue.`,
      `${overview.flaggedCount} flagged.`,
      `${overview.missedCount} most recently missed.`,
    ].join(" ");
    dom.reviewQueueSummary.textContent = reviewSummary;
    dom.reviewReasonBadges.innerHTML = [
      `<span class="chip">Flagged: ${escapeHtml(overview.flaggedCount)}</span>`,
      `<span class="chip">Missed: ${escapeHtml(overview.missedCount)}</span>`,
    ].join("");

    const displayedBreakdown = settings.mode === "simulation"
      ? buildSimulationCategoryTargets(settings.questionCount)
      : officialSimulation.categoryCounts;

    dom.officialBreakdown.innerHTML = displayedBreakdown
      .map(
        (category) => `
          <article class="breakdown-row">
            <span class="breakdown-row-label">${escapeHtml(formatCategoryText(category.id, category.shortLabel))}</span>
            <strong class="breakdown-row-count">${escapeHtml(category.count)}</strong>
          </article>
        `,
      )
      .join("");

    if (!state.storage.recentSessions.length) {
      dom.recentSessionsList.innerHTML = "<p>No completed runs yet.</p>";
    } else {
      dom.recentSessionsList.innerHTML = state.storage.recentSessions
        .map(
          (session) => `
            <article class="review-card">
              <div class="review-card-head">
                <div>
                  <h4>${escapeHtml(MODE_LABELS[session.mode] || "Run")}</h4>
                  <div class="review-meta">${escapeHtml(formatDateTime(session.endedAt))}</div>
                </div>
                <div class="status-row">
                  <span class="status-pill ${session.percent >= 80 ? "correct" : "incorrect"}">${escapeHtml(session.percent)}%</span>
                </div>
              </div>
              <p>${escapeHtml(`${session.correctCount} correct, ${session.incorrectCount} incorrect, ${session.unansweredCount} unanswered.`)}</p>
            </article>
          `,
        )
        .join("");
    }
  }

  function buildModeNote(settings) {
    if (settings.mode === "simulation") {
      const timerText = settings.timerEnabled ? `${settings.timerMinutes} minute timer` : "untimed mode";
      return `Simulation starts from the official ${OFFICIAL_QUESTION_TOTAL}-question / ${officialSimulation.timerMinutes}-minute event. You can run ${settings.questionCount} question(s) in ${timerText}, and the A-M mix stays as close to the official percentages as possible.`;
    }

    if (settings.mode === "bank") {
      const bank = banksById.get(settings.bankId);
      const count = loader.questions.filter((question) => question.bankId === settings.bankId).length;
      return `Specific Bank mode keeps things simple: one bank, your chosen question count, and the same long-term flag/review memory. ${bank ? bank.shortLabel : "This bank"} currently has ${count} question(s).`;
    }

    return "Review Queue mode only pulls questions you flagged or answered incorrectly. Answer them correctly and unflag them to clean the queue out.";
  }

  function setMode(mode) {
    const currentMode = getCurrentMode();
    const nextPreferences = {
      ...state.storage.preferences,
      mode,
    };

    if (mode !== currentMode) {
      if (mode === "simulation") {
        nextPreferences.questionCount = OFFICIAL_QUESTION_TOTAL;
        nextPreferences.timerEnabled = true;
        nextPreferences.timerMinutes = officialSimulation.timerMinutes || 50;
      }

      if (mode === "bank") {
        nextPreferences.questionCount = 25;
        nextPreferences.timerEnabled = false;
        nextPreferences.timerMinutes = 25;
      }

      if (mode === "review") {
        nextPreferences.questionCount = Math.max(1, Math.min(25, getReviewQuestions().length || 25));
        nextPreferences.timerEnabled = false;
        nextPreferences.timerMinutes = 20;
      }
    }

    state.storage.preferences = getEffectiveSettings(nextPreferences);
    saveStorage();
    syncControlsFromPreferences();
    renderSetup();
  }

  function renderSetup() {
    const settings = collectPreferencesFromControls();
    state.storage.preferences = settings;
    saveStorage();

    const reviewQuestions = getReviewQuestions();
    const bankPoolSize = loader.questions.filter((question) => question.bankId === settings.bankId).length;
    const availableCount = settings.mode === "simulation"
      ? MAX_SIMULATION_QUESTION_COUNT
      : settings.mode === "bank"
        ? bankPoolSize
        : reviewQuestions.length;

    dom.modeNote.textContent = buildModeNote(settings);
    dom.bankField.classList.toggle("hidden", settings.mode !== "bank");
    dom.questionCountField.classList.remove("hidden");
    dom.timerEnabledField.classList.remove("hidden");
    dom.timerMinutesField.classList.toggle("hidden", !settings.timerEnabled);

    dom.questionCountInput.max = String(Math.max(1, availableCount || 1));
    dom.questionCountInput.value = String(settings.questionCount);
    dom.timerEnabledInput.checked = settings.timerEnabled;
    dom.timerMinutesInput.value = String(settings.timerMinutes);
    dom.startSessionBtn.textContent = settings.mode === "simulation"
      ? "Start Simulation"
      : settings.mode === "bank"
        ? "Start Bank Drill"
        : "Start Review Run";

    let notice = "";
    if (settings.mode === "review" && availableCount === 0) {
      notice = "Your review queue is empty right now. Flag a question or answer one incorrectly to save it here.";
    } else if (settings.questionCount > availableCount) {
      notice = `Only ${availableCount} question(s) are currently available for this mode. The run will automatically use that amount.`;
    }

    dom.setupNotice.textContent = notice;
    dom.setupNotice.classList.toggle("hidden", !notice);
    renderHero();
    renderOverview(settings);
  }

  function buildSimulationQuestionSet(requestedCount) {
    const categoryTargets = buildSimulationCategoryTargets(requestedCount);
    const selected = [];

    categoryTargets.forEach((categoryTarget) => {
      const pool = loader.questions.filter((question) => question.categoryId === categoryTarget.id);
      const strong = shuffleArray(pool.filter((question) => question.categoryConfidence >= OFFICIAL_SIMULATION_MIN_CONFIDENCE));
      const medium = shuffleArray(pool.filter((question) => question.categoryConfidence < OFFICIAL_SIMULATION_MIN_CONFIDENCE && question.categoryConfidence >= 1));
      const light = shuffleArray(pool.filter((question) => question.categoryConfidence < 1));
      const ranked = [...strong, ...medium, ...light];

      if (ranked.length < categoryTarget.count) {
        throw new Error(`Category ${categoryTarget.id} does not have enough questions for the official simulation.`);
      }

      selected.push(...ranked.slice(0, categoryTarget.count));
    });

    return shuffleArray(selected);
  }

  function getRequestedCount(settings, poolLength) {
    if (settings.mode === "simulation") {
      return Math.max(1, Math.min(settings.questionCount, MAX_SIMULATION_QUESTION_COUNT));
    }
    return Math.max(1, Math.min(settings.questionCount, poolLength));
  }

  function buildQuestionPool(settings) {
    if (settings.mode === "simulation") {
      return buildSimulationQuestionSet(settings.questionCount);
    }

    if (settings.mode === "bank") {
      return loader.questions.filter((question) => question.bankId === settings.bankId);
    }

    return sortReviewQuestions(getReviewQuestions());
  }

  function buildSessionTitle(settings) {
    if (settings.mode === "simulation") {
      return "Official Simulation";
    }

    if (settings.mode === "bank") {
      const bank = banksById.get(settings.bankId);
      return `${bank ? bank.shortLabel : "Specific Bank"} Drill`;
    }

    return "Review Queue Run";
  }

  function buildSessionSubtitle(settings, questionCount) {
    if (settings.mode === "simulation") {
      return `${questionCount} questions across the official A-M breakdown.`;
    }

    if (settings.mode === "bank") {
      const bank = banksById.get(settings.bankId);
      return `${questionCount} question(s) from ${bank ? bank.shortLabel : "the selected bank"}.`;
    }

    return `${questionCount} review question(s) from your saved follow-up queue.`;
  }

  function buildEntries(questions, settings) {
    return questions.map((question) => {
      const choices = settings.choiceOrder === "shuffle" ? shuffleArray(question.choices) : question.choices.map((choice) => ({ ...choice }));
      return {
        question,
        choices,
        selectedChoiceId: null,
        locked: false,
        revealed: false,
      };
    });
  }

  function setView(viewName) {
    state.view = viewName;
    dom.setupView.classList.toggle("hidden", viewName !== "setup");
    dom.sessionView.classList.toggle("hidden", viewName !== "session");
    dom.resultsView.classList.toggle("hidden", viewName !== "results");
  }

  function startSession(overrides = {}) {
    const settings = getEffectiveSettings({
      ...collectPreferencesFromControls(),
      ...overrides,
    });

    const pool = buildQuestionPool(settings);
    const requestedCount = getRequestedCount(settings, pool.length);

    if (!pool.length) {
      renderSetup();
      return;
    }

    const chosenQuestions = settings.mode === "simulation"
      ? pool
      : settings.mode === "review"
        ? pool.slice(0, requestedCount)
        : shuffleArray(pool).slice(0, requestedCount);

    const startedAt = Date.now();
    const endsAt = settings.timerEnabled ? startedAt + settings.timerMinutes * 60 * 1000 : null;

    state.session = {
      id: `session-${startedAt}`,
      mode: settings.mode,
      title: buildSessionTitle(settings),
      settings,
      startedAt,
      endsAt,
      currentIndex: 0,
      entries: buildEntries(chosenQuestions, settings),
      timerHandle: null,
    };

    state.lastResult = null;
    setView("session");
    startTimer();
    renderSession();
  }

  function startTimer() {
    stopTimer();

    if (!state.session || !state.session.endsAt) {
      if (dom.timerDisplay) {
        dom.timerDisplay.textContent = "Untimed";
      }
      return;
    }

    const tick = () => {
      if (!state.session || !state.session.endsAt) {
        return;
      }

      const msRemaining = state.session.endsAt - Date.now();
      dom.timerDisplay.textContent = formatDuration(msRemaining);

      if (msRemaining <= 0) {
        submitSession({ forced: true });
      }
    };

    tick();
    state.session.timerHandle = window.setInterval(tick, 1000);
  }

  function stopTimer() {
    if (state.session && state.session.timerHandle) {
      window.clearInterval(state.session.timerHandle);
      state.session.timerHandle = null;
    }
  }

  function getCurrentEntry() {
    if (!state.session) {
      return null;
    }
    return state.session.entries[state.session.currentIndex] || null;
  }

  function selectChoice(choiceId) {
    const entry = getCurrentEntry();
    if (!entry) {
      return;
    }

    if (entry.locked && state.session.settings.feedbackMode === "immediate") {
      return;
    }

    entry.selectedChoiceId = choiceId;

    if (state.session.settings.feedbackMode === "immediate") {
      entry.revealed = true;
      entry.locked = true;
    }

    renderSession();
  }

  function toggleFlagForCurrentQuestion() {
    const entry = getCurrentEntry();
    if (!entry) {
      return;
    }

    const questionState = getQuestionState(entry.question.id);
    questionState.flagged = !questionState.flagged;
    saveStorage();
    renderSession();
    renderHero();
    renderOverview();
  }

  function goToQuestion(index) {
    if (!state.session) {
      return;
    }

    state.session.currentIndex = Math.max(0, Math.min(index, state.session.entries.length - 1));
    renderSession();
  }

  function moveQuestion(step) {
    goToQuestion(state.session.currentIndex + step);
  }

  function jumpToFlagged() {
    if (!state.session) {
      return;
    }

    const flaggedIndex = state.session.entries.findIndex((entry) => getReviewStatus(entry.question.id).flagged);
    if (flaggedIndex >= 0) {
      goToQuestion(flaggedIndex);
    }
  }

  function getSessionAnsweredCount() {
    if (!state.session) {
      return 0;
    }

    return state.session.entries.filter((entry) => entry.selectedChoiceId).length;
  }

  function getSessionReviewTriggerCount() {
    if (!state.session) {
      return 0;
    }

    return state.session.entries.filter((entry) => {
      const reviewStatus = getReviewStatus(entry.question.id);
      const wrongNow = entry.selectedChoiceId && entry.selectedChoiceId !== entry.question.answerLetter;
      return reviewStatus.flagged || wrongNow;
    }).length;
  }

  function renderSession() {
    if (!state.session) {
      return;
    }

    const entry = getCurrentEntry();
    const reviewStatus = getReviewStatus(entry.question.id);

    dom.sessionModeChip.textContent = MODE_LABELS[state.session.mode];
    dom.sessionTitle.textContent = state.session.title;
    dom.sessionSubtitle.textContent = buildSessionSubtitle(state.session.settings, state.session.entries.length);
    dom.progressValue.textContent = `${state.session.currentIndex + 1} / ${state.session.entries.length}`;
    dom.answeredValue.textContent = String(getSessionAnsweredCount());
    dom.reviewValue.textContent = String(getSessionReviewTriggerCount());
    if (!state.session.endsAt) {
      dom.timerDisplay.textContent = "Untimed";
    }

    dom.questionPosition.textContent = `Question ${state.session.currentIndex + 1} of ${state.session.entries.length}`;
    dom.questionSourceChip.textContent = formatSourceText(entry.question.bankShortLabel, entry.question.questionNumber);
    dom.questionCategoryChip.textContent = formatCategoryText(entry.question.categoryId, entry.question.categoryShortLabel);
    dom.questionPrompt.textContent = entry.question.prompt;

    dom.flagBtnLabel.textContent = reviewStatus.flagged ? "Flagged" : "Flag";
    dom.flagBtn.classList.toggle("is-active", reviewStatus.flagged);
    dom.flagBtn.classList.toggle("is-flagged", reviewStatus.flagged);
    dom.jumpFlaggedBtn.disabled = !state.session.entries.some((sessionEntry) => getReviewStatus(sessionEntry.question.id).flagged);
    dom.sessionHint.textContent = "Flagged or missed questions are automatically saved into your review queue.";

    dom.answerList.innerHTML = "";
    entry.choices.forEach((choice) => {
      const choiceButton = document.createElement("button");
      choiceButton.type = "button";
      choiceButton.className = "choice-card";
      choiceButton.innerHTML = `<strong>${escapeHtml(choice.id)}</strong><span>${escapeHtml(choice.text)}</span>`;
      choiceButton.addEventListener("click", () => selectChoice(choice.id));

      const isSelected = entry.selectedChoiceId === choice.id;
      const showResult = state.session.settings.feedbackMode === "immediate" && entry.revealed;

      if (isSelected) {
        choiceButton.classList.add("is-selected");
      }

      if (showResult && choice.id === entry.question.answerLetter) {
        choiceButton.classList.add("is-correct");
      }

      if (showResult && isSelected && choice.id !== entry.question.answerLetter) {
        choiceButton.classList.add("is-incorrect");
      }

      if (entry.locked && state.session.settings.feedbackMode === "immediate") {
        choiceButton.classList.add("is-disabled");
        choiceButton.disabled = true;
      }

      dom.answerList.appendChild(choiceButton);
    });

    const showFeedback = state.session.settings.feedbackMode === "immediate" && entry.revealed;
    dom.feedbackCard.classList.toggle("hidden", !showFeedback);
    dom.feedbackCard.classList.remove("correct", "incorrect");

    if (showFeedback) {
      const isCorrect = entry.selectedChoiceId === entry.question.answerLetter;
      const pickedChoice = entry.choices.find((choice) => choice.id === entry.selectedChoiceId);
      const correctChoice = entry.choices.find((choice) => choice.id === entry.question.answerLetter);
      dom.feedbackCard.classList.add(isCorrect ? "correct" : "incorrect");
      dom.feedbackCard.innerHTML = `
        <h4>${isCorrect ? "Correct" : "Review this one"}</h4>
        <div class="status-row">
          <span class="status-pill ${isCorrect ? "correct" : "incorrect"}">${escapeHtml(isCorrect ? "Correct" : "Incorrect")}</span>
          ${reviewStatus.flagged ? '<span class="status-pill flagged">Flagged</span>' : ""}
        </div>
        <p class="feedback-support"><strong>Your answer:</strong> ${escapeHtml(pickedChoice ? `${pickedChoice.id}. ${pickedChoice.text}` : "No answer selected")}</p>
        <p class="feedback-support"><strong>Correct answer:</strong> ${escapeHtml(correctChoice ? `${correctChoice.id}. ${correctChoice.text}` : `${entry.question.answerLetter}. ${entry.question.correctChoiceText}`)}</p>
      `;
    } else {
      dom.feedbackCard.innerHTML = "";
    }

    dom.prevQuestionBtn.disabled = state.session.currentIndex === 0;
    dom.nextQuestionBtn.disabled = state.session.currentIndex === state.session.entries.length - 1;
  }

  function buildResultFromSession(session) {
    const endedAt = Date.now();
    const reviewEntries = session.entries.map((entry) => {
      const selectedChoice = entry.choices.find((choice) => choice.id === entry.selectedChoiceId) || null;
      const correctChoice = entry.choices.find((choice) => choice.id === entry.question.answerLetter) || null;
      const correct = entry.selectedChoiceId === entry.question.answerLetter;
      const unanswered = !entry.selectedChoiceId;
      const reviewStatus = getReviewStatus(entry.question.id);

      return {
        questionId: entry.question.id,
        bankShortLabel: entry.question.bankShortLabel,
        questionNumber: entry.question.questionNumber,
        prompt: entry.question.prompt,
        categoryId: entry.question.categoryId,
        categoryShortLabel: entry.question.categoryShortLabel,
        selectedChoiceText: selectedChoice ? `${selectedChoice.id}. ${selectedChoice.text}` : "No answer selected",
        correctChoiceText: correctChoice ? `${correctChoice.id}. ${correctChoice.text}` : `${entry.question.answerLetter}. ${entry.question.correctChoiceText}`,
        correct,
        unanswered,
        flagged: reviewStatus.flagged,
      };
    });

    const correctCount = reviewEntries.filter((entry) => entry.correct).length;
    const unansweredCount = reviewEntries.filter((entry) => entry.unanswered).length;
    const incorrectCount = reviewEntries.length - correctCount - unansweredCount;
    const percent = Math.round((correctCount / reviewEntries.length) * 100);

    return {
      id: session.id,
      mode: session.mode,
      settings: session.settings,
      title: session.title,
      startedAt: session.startedAt,
      endedAt,
      durationMs: endedAt - session.startedAt,
      total: reviewEntries.length,
      correctCount,
      incorrectCount,
      unansweredCount,
      percent,
      reviewEntries,
    };
  }

  function applyResultToStorage(result) {
    result.reviewEntries.forEach((reviewEntry) => {
      const questionState = getQuestionState(reviewEntry.questionId);
      questionState.seenCount += 1;
      questionState.lastSeenAt = result.endedAt;
      questionState.lastSessionMode = result.mode;
      questionState.lastAnsweredAt = result.endedAt;

      if (reviewEntry.correct) {
        questionState.correctCount += 1;
        questionState.lastOutcome = "correct";
        questionState.reviewMissed = false;
      } else if (reviewEntry.unanswered) {
        questionState.unansweredCount += 1;
        questionState.lastOutcome = "unanswered";
        questionState.reviewMissed = false;
      } else {
        questionState.incorrectCount += 1;
        questionState.lastOutcome = "incorrect";
        questionState.reviewMissed = true;
      }
    });

    state.storage.recentSessions.unshift({
      id: result.id,
      mode: result.mode,
      total: result.total,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      unansweredCount: result.unansweredCount,
      percent: result.percent,
      endedAt: result.endedAt,
    });
    state.storage.recentSessions = state.storage.recentSessions.slice(0, MAX_RECENT_SESSIONS);
    saveStorage();
  }

  function submitSession({ forced = false } = {}) {
    if (!state.session) {
      return;
    }

    const unansweredCount = state.session.entries.filter((entry) => !entry.selectedChoiceId).length;
    const flaggedCount = state.session.entries.filter((entry) => getReviewStatus(entry.question.id).flagged).length;

    if (!forced) {
      const confirmed = window.confirm(`Submit this run now?\n\nUnanswered: ${unansweredCount}\nFlagged: ${flaggedCount}`);
      if (!confirmed) {
        return;
      }
    }

    stopTimer();
    const result = buildResultFromSession(state.session);
    applyResultToStorage(result);
    state.lastResult = result;
    state.session = null;
    setView("results");
    renderHero();
    renderOverview();
    renderResults();
  }

  function renderResults() {
    if (!state.lastResult) {
      return;
    }

    const result = state.lastResult;
    dom.resultsHeadline.textContent = `${result.title} Complete`;
    dom.resultsSubline.textContent = `${result.correctCount} correct, ${result.incorrectCount} incorrect, ${result.unansweredCount} unanswered in ${formatDuration(result.durationMs)}.`;
    dom.resultsReviewRunBtn.disabled = getReviewQuestions().length === 0;

    const stats = [
      { label: "Score", value: `${result.percent}%` },
      { label: "Correct", value: result.correctCount },
      { label: "Incorrect", value: result.incorrectCount },
      { label: "Unanswered", value: result.unansweredCount },
    ];

    dom.resultsStats.innerHTML = stats
      .map(
        (stat) => `
          <article class="stat-card">
            <span class="label">${escapeHtml(stat.label)}</span>
            <strong>${escapeHtml(stat.value)}</strong>
          </article>
        `,
      )
      .join("");

    const priorityEntries = [...result.reviewEntries]
      .filter((entry) => entry.flagged || (!entry.correct && !entry.unanswered))
      .sort((left, right) => {
        const leftScore = (left.correct ? 0 : 3) + (left.flagged ? 2 : 0);
        const rightScore = (right.correct ? 0 : 3) + (right.flagged ? 2 : 0);
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        return left.questionId.localeCompare(right.questionId);
      });

    if (!priorityEntries.length) {
      dom.resultsReviewList.innerHTML = "<p>No follow-up questions from this run. Your review queue is clean unless you previously saved other items.</p>";
      return;
    }

    dom.resultsReviewList.innerHTML = priorityEntries
      .map((entry) => {
        const statusPills = [];
        statusPills.push(`<span class="status-pill ${entry.correct ? "correct" : "incorrect"}">${escapeHtml(entry.correct ? "Correct" : entry.unanswered ? "Unanswered" : "Incorrect")}</span>`);
        if (entry.flagged) statusPills.push('<span class="status-pill flagged">Flagged</span>');

        return `
          <article class="review-card">
            <div class="review-card-head">
              <div>
                <h4>${escapeHtml(entry.prompt)}</h4>
                <div class="review-meta">${escapeHtml(formatReviewMeta(entry.bankShortLabel, entry.questionNumber, entry.categoryId, entry.categoryShortLabel))}</div>
              </div>
              <div class="status-row">${statusPills.join("")}</div>
            </div>
            <p><strong>Your answer:</strong> ${escapeHtml(entry.selectedChoiceText)}</p>
            <p><strong>Correct answer:</strong> ${escapeHtml(entry.correctChoiceText)}</p>
          </article>
        `;
      })
      .join("");
  }

  function openModal({ eyebrow, title, bodyHtml }) {
    dom.modalEyebrow.textContent = eyebrow;
    dom.modalTitle.textContent = title;
    dom.modalBody.innerHTML = bodyHtml;
    dom.modalBackdrop.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    dom.modalBackdrop.classList.add("hidden");
    dom.modalBody.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function buildQuestionFacts(question) {
    const bank = banksById.get(question.bankId);
    const questionState = getQuestionState(question.id);
    const reviewStatus = getReviewStatus(question.id);
    const duplicateBanks = question.duplicateGroupSize > 1 ? question.duplicateBankLabels.join(", ") : "This version is unique.";
    const category = categoriesById.get(question.categoryId);

    return `
      <section class="modal-section">
        <h3>${escapeHtml(question.prompt)}</h3>
        <div class="facts-grid">
          <article class="fact-card">
            <span>Bank</span>
            <strong>${escapeHtml(question.bankShortLabel)}</strong>
          </article>
          <article class="fact-card">
            <span>Source Number</span>
            <strong>Question ${escapeHtml(question.questionNumber)}</strong>
          </article>
          <article class="fact-card">
            <span>Category</span>
            <strong>${escapeHtml(category ? formatCategoryText(category.id, category.label) : formatCategoryText(question.categoryId, question.categoryLabel))}</strong>
          </article>
          <article class="fact-card">
            <span>Review Status</span>
            <strong>${escapeHtml(reviewStatus.isReview ? "In review queue" : "Not in review queue")}</strong>
          </article>
          <article class="fact-card">
            <span>Flagged</span>
            <strong>${escapeHtml(reviewStatus.flagged ? "Yes" : "No")}</strong>
          </article>
          <article class="fact-card">
            <span>Seen</span>
            <strong>${escapeHtml(questionState.seenCount)}</strong>
          </article>
          <article class="fact-card">
            <span>Correct / Incorrect</span>
            <strong>${escapeHtml(`${questionState.correctCount} / ${questionState.incorrectCount}`)}</strong>
          </article>
          <article class="fact-card">
            <span>Last Outcome</span>
            <strong>${escapeHtml(questionState.lastOutcome || "Not answered yet")}</strong>
          </article>
          <article class="fact-card">
            <span>Duplicate Banks</span>
            <strong>${escapeHtml(duplicateBanks)}</strong>
          </article>
          <article class="fact-card">
            <span>Source File</span>
            <strong>${escapeHtml(question.bankFileName)}</strong>
          </article>
          <article class="fact-card">
            <span>Last Seen</span>
            <strong>${escapeHtml(formatDateTime(questionState.lastSeenAt))}</strong>
          </article>
        </div>
      </section>
      <section class="modal-section">
        <h3>Answer Key</h3>
        <p>Correct answer: <strong>${escapeHtml(`${question.answerLetter}. ${question.correctChoiceText}`)}</strong></p>
        ${question.answerAdjusted ? `<p class="feedback-support">Source answer key adjusted during compilation: ${escapeHtml(question.answerAdjustmentReason)}</p>` : ""}
      </section>
      <section class="modal-section">
        <h3>Bank Metadata</h3>
        <p>${escapeHtml(bank ? `${bank.shortLabel} is stored as a ${bank.categoryLabel.toLowerCase()} bank.` : question.bankCategoryLabel)}</p>
      </section>
    `;
  }

  function openCurrentQuestionInfo() {
    const entry = getCurrentEntry();
    if (!entry) {
      return;
    }

    openModal({
      eyebrow: "Question Details",
      title: formatQuestionTitle(entry.question.bankShortLabel, entry.question.questionNumber),
      bodyHtml: buildQuestionFacts(entry.question),
    });
  }

  function openReviewQueueInfo() {
    const reviewQuestions = sortReviewQuestions(getReviewQuestions());

    if (!reviewQuestions.length) {
      openModal({
        eyebrow: "Review Queue",
        title: "No Review Questions Yet",
        bodyHtml: "<p>Your review queue is currently empty. Questions enter it when you flag them or answer them incorrectly.</p>",
      });
      return;
    }

    const cards = reviewQuestions
      .map((question) => {
        const questionState = getQuestionState(question.id);
        const reviewStatus = getReviewStatus(question.id);
        const reasons = [];
        if (reviewStatus.flagged) reasons.push('<span class="status-pill flagged">Flagged</span>');
        if (reviewStatus.reviewMissed) reasons.push('<span class="status-pill incorrect">Missed</span>');

        return `
          <article class="review-card">
            <div class="review-card-head">
              <div>
                <h4>${escapeHtml(question.prompt)}</h4>
                <div class="review-meta">${escapeHtml(formatReviewMeta(question.bankShortLabel, question.questionNumber, question.categoryId, question.categoryShortLabel))}</div>
              </div>
              <div class="status-row">${reasons.join("")}</div>
            </div>
            <p><strong>Last outcome:</strong> ${escapeHtml(questionState.lastOutcome || "Not answered yet")}</p>
            <p><strong>Performance:</strong> ${escapeHtml(`${questionState.correctCount} correct / ${questionState.incorrectCount} incorrect`)}</p>
            <p><strong>Answer key:</strong> ${escapeHtml(`${question.answerLetter}. ${question.correctChoiceText}`)}</p>
          </article>
        `;
      })
      .join("");

    openModal({
      eyebrow: "Review Queue",
      title: `Review Questions (${reviewQuestions.length})`,
      bodyHtml: `<div class="modal-list">${cards}</div>`,
    });
  }

  function resetProgress() {
    const confirmed = window.confirm("Reset all local flags, review memory, and recent session history?");
    if (!confirmed) {
      return;
    }

    state.storage = normalizeStorage(null);
    state.lastResult = null;
    state.session = null;
    saveStorage();
    syncControlsFromPreferences();
    stopTimer();
    setView("setup");
    renderSetup();
  }

  function leaveSession() {
    if (!state.session) {
      setView("setup");
      renderSetup();
      return;
    }

    const confirmed = window.confirm("Leave this run and discard its current answers? Your saved flags and prior review memory will stay on this device.");
    if (!confirmed) {
      return;
    }

    stopTimer();
    state.session = null;
    setView("setup");
    renderSetup();
  }

  function populateBankSelect() {
    dom.bankSelect.innerHTML = loader.banks
      .map((bank) => `<option value="${escapeHtml(bank.id)}">${escapeHtml(`${bank.shortLabel} (${bank.questionCount})`)}</option>`)
      .join("");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (window.location.protocol === "file:") {
      return;
    }

    let hasReloadedForServiceWorker = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloadedForServiceWorker) {
        return;
      }
      hasReloadedForServiceWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(`./service-worker.js?v=${SW_VERSION}`)
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed.", error);
      });
  }

  function bindEvents() {
    dom.modeButtons.forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    });

    [
      dom.bankSelect,
      dom.questionCountInput,
      dom.timerEnabledInput,
      dom.timerMinutesInput,
      dom.feedbackModeSelect,
      dom.choiceOrderSelect,
    ].forEach((element) => {
      element.addEventListener("change", renderSetup);
      element.addEventListener("input", renderSetup);
    });

    dom.startSessionBtn.addEventListener("click", () => startSession());
    dom.resetProgressBtn.addEventListener("click", resetProgress);
    dom.openReviewQueueInfoBtn.addEventListener("click", openReviewQueueInfo);
    dom.backToSetupBtn.addEventListener("click", leaveSession);
    dom.submitSessionBtn.addEventListener("click", () => submitSession());
    dom.prevQuestionBtn.addEventListener("click", () => moveQuestion(-1));
    dom.nextQuestionBtn.addEventListener("click", () => moveQuestion(1));
    dom.jumpFlaggedBtn.addEventListener("click", jumpToFlagged);
    dom.flagBtn.addEventListener("click", toggleFlagForCurrentQuestion);
    dom.questionInfoBtn.addEventListener("click", openCurrentQuestionInfo);
    dom.resultsBackBtn.addEventListener("click", () => {
      setView("setup");
      renderSetup();
    });
    dom.resultsReviewRunBtn.addEventListener("click", () => startSession({ mode: "review" }));
    dom.closeModalBtn.addEventListener("click", closeModal);
    dom.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === dom.modalBackdrop) {
        closeModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dom.modalBackdrop.classList.contains("hidden")) {
        closeModal();
      }
    });
  }

  function init() {
    populateBankSelect();
    syncControlsFromPreferences();
    bindEvents();
    setView("setup");
    renderSetup();
    registerServiceWorker();
  }

  init();
})();
