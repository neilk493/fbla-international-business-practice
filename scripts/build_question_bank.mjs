import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");

const ANSWER_OVERRIDES = {
  "FBLC_OT1_Bank.md#68": {
    answerLetter: "A",
    reason: "Aligned with the identical OT3 item and the shipping-risk wording in the prompt.",
  },
  "FBLC_OT3_Bank.md#29": {
    answerLetter: "C",
    reason: "Aligned with the identical OT1 item and the standard sole-proprietorship disadvantage.",
  },
};

const CATEGORY_ORDER = [
  {
    id: "A",
    label: "Basic International Concepts",
    shortLabel: "Basic Concepts",
    officialCount: 15,
    corpus:
      "economic systems inflation gdp purchasing power parity balance of trade cost of living scarcity opportunity cost economic development geography natural resources infrastructure ethnocentrism cultural bias globalization trade deficit trade surplus united nations developed developing countries comparative advantage absolute advantage mercantilism specialization emerging markets trading regions political unrest oil producing regions free markets",
    patterns: [
      { regex: /\b(gdp|gross domestic product|ppp|purchasing power parity|balance of trade|trade deficit|trade surplus|inflation|cost of living|scarcity|opportunity cost|economic development|economic system|market economy|command economy|traditional economy|socialist economy|communist economy|capitalist economy|natural resources?|infrastructure|ethnocentrism|cultural bias|globalization|united nations|standard of living|comparative advantage|absolute advantage|mercantilism|specialization|emerging markets?)\b/i, weight: 5 },
      { regex: /\b(climate|topography|time zones?|geography|literacy level|foreign debt|developed countr|developing countr|underdeveloped countr|trading regions?|oil[- ]producing region|political unrest|cross-border regulations?|national borders?)\b/i, weight: 4 },
    ],
  },
  {
    id: "B",
    label: "Ownership and Management",
    shortLabel: "Ownership",
    officialCount: 15,
    corpus:
      "ownership management entrepreneurs organizational structures planning organizing influencing controlling licensing franchising exporting joint ventures monopoly oligopoly pure competition iso 9000 qs 9000 foreign direct investment sole proprietorship partnership corporation risk reward wholly owned subsidiary parent company decentralized centralized management multinational corporation geocentric polycentric ethnocentric regiocentric",
    patterns: [
      { regex: /\b(sole proprietorship|partnership|corporation|ownership|entrepreneur|organizational structure|planning|organizing|influencing|controlling|licensing|franchising|joint venture|joint ventures|exporting|indirect exporting|direct exporting|monopoly|oligopoly|pure competition|iso 9000|qs 9000|foreign direct investment|fdi|wholly owned subsidiary|subsidiary|parent compan|multinational corporation|decentralized decision-making|centralized decision-making|geocentric|polycentric|ethnocentric|regiocentric)\b/i, weight: 5 },
      { regex: /\b(risk and reward|international business opportunities|standardization organization|iso standards?|management style|co-ownership|foreign operation|local managers?)\b/i, weight: 4 },
    ],
  },
  {
    id: "C",
    label: "Legal Issues",
    shortLabel: "Legal",
    officialCount: 5,
    corpus:
      "legal issues common law civil law statutory law theocratic law contracts liability consumer protection product liability arbitration mediation litigation copyrights trademarks patents intellectual property judicial systems labor laws foreign corrupt practices act fcpa expropriation choice of law choice of forum public domain",
    patterns: [
      { regex: /\b(common law|civil law|statutory law|theocratic law|contract|contracts|liability|consumer protection|product liability|arbitration|mediation|litigation|copyright|trademark|patent|intellectual property|judicial|legal system|labor laws?|foreign corrupt practices act|fcpa|expropriation|choice of law|choice of forum|public domain)\b/i, weight: 6 },
      { regex: /\b(consumer bill of rights|repatriation|judicial systems?|licensing legal|resolve legal differences|bribe foreign officials|govern a dispute)\b/i, weight: 4 },
    ],
  },
  {
    id: "D",
    label: "Communication",
    shortLabel: "Communication",
    officialCount: 7,
    corpus:
      "communication language translation nonverbal etiquette protocol gift giving attire greetings gestures body language eye contact negotiations multicultural electronic communication webcast podcast blogging video conferencing cultural sensitivity cross cultural competence stereotyping high context low context gender roles communication style",
    patterns: [
      { regex: /\b(nonverbal|verbal|communication|translation|translate|interpreter|interpreting|language|etiquette|protocol|gift giving|greetings?|introductions?|gestures?|body language|eye contact|negotiation|negotiating|video conferencing|webcast|podcast|blogging|electronic communication|cultural sensitivity|cross-cultural competence|cross cultural competence|high-context|high context|low-context|low context|stereotyping|multiculturalism)\b/i, weight: 6 },
      { regex: /\b(attire|jargon|tone|style|format|cultural etiquette|business protocol|gender roles|communication style|misunderstanding|scheduling)\b/i, weight: 4 },
    ],
  },
  {
    id: "E",
    label: "Marketing",
    shortLabel: "Marketing",
    officialCount: 15,
    corpus:
      "marketing advertising promotion packaging pricing product life cycle market research marketing mix consumer behavior distribution retailers wholesalers agents freight forwarders customs brokers direct distribution indirect distribution transportation shipping fob cif media availability slogans trademarks localization standardization local tastes brand recognition penetration pricing price skimming gray market",
    patterns: [
      { regex: /\b(marketing|advertising|promotion|promotional|packaging|package design|pricing|price|market research|marketing mix|consumer behavior|product life cycle|distribution|wholesaler|retailer|freight forwarder|customs broker|direct distribution|indirect distribution|transportation|shipping|fob|cif|media availability|localization|localized|local tastes|market localization|standardized global marketing|global brand|brand recognition|penetration pricing|price skimming|prestige pricing|cost-plus pricing|gray market)\b/i, weight: 6 },
      { regex: /\b(agent|agents|trading compan|export compan|bill of lading|perishable|slogan|slogans|trademark translation|packaged goods|product line|marketing campaigns?|target market|customer needs)\b/i, weight: 4 },
    ],
  },
  {
    id: "F",
    label: "Taxes and Government Regulations",
    shortLabel: "Government",
    officialCount: 3,
    corpus:
      "governments taxation taxes export assistance government agencies department of commerce state agencies federal agencies democracy constitutional monarchy dictatorship regulation regulatory transfer pricing double taxation economic freedom private ownership public ownership government ownership",
    patterns: [
      { regex: /\b(tax|taxes|taxation|government agencies|department of commerce|export assistance|federal agencies|state agencies|constitutional monarchy|dictatorship|democracy|autocratic|types of governments?|government own all the major factors|transfer pricing|double taxation|economic freedom|private ownership|public ownership|government ownership)\b/i, weight: 6 },
      { regex: /\b(regulations?|regulatory|tax deferred|tax structures?|small business administration|government type|political system)\b/i, weight: 4 },
    ],
  },
  {
    id: "G",
    label: "Treaties and Trade Agreements",
    shortLabel: "Trade Agreements",
    officialCount: 7,
    corpus:
      "trade agreements treaties wto gatt eu european union nafta usmca mercosur asean tariffs quotas trade barriers customs service customs regulations most favored nation importing exporting foreign trade customs duties trade alliances single market customs union trade bloc free trade area trade rules",
    patterns: [
      { regex: /\b(wto|world trade organization|gatt|european union|eu\b|nafta|usmca|mercosur|asean|tariffs?|quotas?|trade barriers?|customs service|customs regulations?|most[- ]favored[- ]nation|mfn|trade agreement|trade agreements|treaties|free trade area|customs union|single market|trade bloc)\b/i, weight: 7 },
      { regex: /\b(importing|exporting|imports?|exports?|foreign trade|trade alliance|customs duties|licensing requirements|trade incentives|trade rules|trade disputes|non-tariff barriers?|product standards|reducing trade barriers)\b/i, weight: 4 },
    ],
  },
  {
    id: "H",
    label: "Currency Exchange",
    shortLabel: "Currency",
    officialCount: 3,
    corpus:
      "currency exchange rates appreciation depreciation floating fixed convertible nonconvertible foreign exchange forex devaluation revaluation currency value yuan yen euro euros rial peso pound dollars dollar renminbi strengthened weakened",
    patterns: [
      { regex: /\b(exchange rate|exchange rates|currency|currencies|foreign exchange|forex|appreciation|depreciation|floating|fixed exchange rate|convertible|nonconvertible|devaluation|revaluation|currency value|yuan|yen|euro|euros|rial|peso|pound|dollar|dollars|renminbi|strengthened|weakened)\b/i, weight: 7 },
      { regex: /\b(value of money|foreign currency|spot rate|interest rates? affect international trade|u s dollar|us dollar|how many dollars|worth more|worth less)\b/i, weight: 4 },
    ],
  },
  {
    id: "I",
    label: "Finance",
    shortLabel: "Finance",
    officialCount: 15,
    corpus:
      "finance capital stock market bond market imf international monetary fund world bank countertrade offset payment documents equity debt credit letter of credit capital markets investment commercial risk political risk foreign exchange risk eurobond loans financial assistance developing countries financing",
    patterns: [
      { regex: /\b(finance|capital market|capital markets|stock market|bond market|imf|international monetary fund|world bank|countertrade|offset|equity capital|debt capital|letter of credit|payment documents?|eurobond|commercial risk|political risk|foreign exchange risk|financial assistance|global business financing)\b/i, weight: 7 },
      { regex: /\b(raise funds|finances trade|sources of capital|investment|investments|credit|drafts?|payment for international trade|loans to developing countries|financial instrument|financing)\b/i, weight: 4 },
    ],
  },
  {
    id: "J",
    label: "Human Resource Management",
    shortLabel: "HR",
    officialCount: 5,
    corpus:
      "human resources recruitment selection employee development compensation promotion benefits incentives motivation staffing policy host country nationals expatriate polycentric ethnocentric geocentric regiocentric labor pool working conditions living conditions health safety labor conflict outsourcing offshoring international labour organization labor standards employees personnel staffing",
    patterns: [
      { regex: /\b(human resource|recruitment|selection|employee development|compensation|promotion|benefits?|incentives?|motivation|staffing policy|host-country nationals|host country nationals|expatriate|polycentric|ethnocentric|geocentric|regiocentric|labor pool|working conditions|living conditions|health and safety|labor conflict|outsourcing|offshoring|international labour organization|international labor organization|labor standards|labour standards)\b/i, weight: 7 },
      { regex: /\b(workday|workweek|schedules|holidays for workers|global labor pool|employees|personnel|staffing|workers)\b/i, weight: 4 },
    ],
  },
  {
    id: "K",
    label: "Ethics",
    shortLabel: "Ethics",
    officialCount: 5,
    corpus:
      "ethics social responsibility honesty integrity compassion justice unethical bribery corruption moral host country ethical issues code of ethics",
    patterns: [
      { regex: /\b(ethic|ethics|ethical|social responsibility|honesty|integrity|compassion|justice|unethical|bribery|corruption|moral|code of ethics)\b/i, weight: 7 },
      { regex: /\b(host country|ethical issue|ethical issues|values shared by cultures)\b/i, weight: 4 },
    ],
  },
  {
    id: "L",
    label: "International Travel",
    shortLabel: "Travel",
    officialCount: 3,
    corpus:
      "international travel visa passport embassies consulates travel advisories travel restrictions travel documents health requirements representational offices customs agencies abroad airline security travel warning state department",
    patterns: [
      { regex: /\b(travel|travel advisory|travel advisories|travel restrictions|visa|passport|passports|embassy|embassies|consulate|consulates|travel documents|health requirements|representational offices|located abroad|airline security)\b/i, weight: 7 },
      { regex: /\b(international business travel|u s customs and the customs agencies of other countries|employment documents for travel|state department|travel warning)\b/i, weight: 4 },
    ],
  },
  {
    id: "M",
    label: "Career Development",
    shortLabel: "Careers",
    officialCount: 2,
    corpus:
      "career development career opportunities resume interview hiring qualifications employability job listings application professional skills international careers",
    patterns: [
      { regex: /\b(career|careers|career development|resume|interview|hiring|qualifications|employability|job listings|career opportunities|application|cover letter)\b/i, weight: 7 },
      { regex: /\b(skills needed|skills and qualifications|international careers|employment opportunities)\b/i, weight: 4 },
    ],
  },
];

const CATEGORY_BY_ID = new Map(CATEGORY_ORDER.map((category) => [category.id, category]));
const ALL_CATEGORY_IDS = CATEGORY_ORDER.map((category) => category.id);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "their",
  "there",
  "which",
  "what",
  "when",
  "where",
  "would",
  "could",
  "should",
  "about",
  "across",
  "other",
  "these",
  "those",
  "being",
  "have",
  "has",
  "into",
  "through",
  "between",
  "because",
  "while",
  "within",
  "among",
  "each",
  "does",
  "doing",
  "done",
  "your",
  "their",
  "them",
  "they",
  "them",
  "more",
  "less",
  "over",
  "under",
  "most",
  "least",
  "best",
  "following",
  "international",
  "business",
  "global",
  "country",
  "countries",
  "company",
  "companies",
  "product",
  "products",
]);

const CATEGORY_CORPUS_TOKENS = new Map(
  CATEGORY_ORDER.map((category) => [category.id, new Set(tokenizeForClassifier(category.corpus))]),
);

const GROUPED_BANK_CANDIDATES = [
  { regex: /^FBLC_ABC_Competency_Specific_Test_Bank\.md$/i, categoryIds: ["A", "B", "C"] },
  { regex: /^FBLC_DEF_Competency_Specific_Test_Bank\.md$/i, categoryIds: ["D", "E", "F"] },
  { regex: /^FBLC_GHI_Competency_Specific_Test_Bank\.md$/i, categoryIds: ["G", "H", "I"] },
  { regex: /^FBLC_JKLM_Competency_Specific_Test_Bank\.md$/i, categoryIds: ["J", "K", "L", "M"] },
];

const CATEGORY_OVERRIDES = {
  "FBLC_OT1_Bank.md#69": "F",
};

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanInline(text) {
  return text
    .replace(/`+/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  return cleanInline(text)
    .toLowerCase()
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9'" ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForClassifier(text) {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function deriveBankMeta(fileName, title, statusNotes) {
  const bankId = toSlug(fileName.replace(/\.md$/i, ""));
  const baseMeta = {
    id: bankId,
    fileName,
    title,
    statusNotes,
    categoryId: "general",
    categoryLabel: "General Bank",
    shortLabel: title.replace(/\s+Bank$/i, "").trim(),
  };

  if (/^FBLC_OT\d+_Bank\.md$/i.test(fileName)) {
    const match = fileName.match(/^FBLC_(OT\d+)_Bank\.md$/i);
    return {
      ...baseMeta,
      categoryId: "objective-test",
      categoryLabel: "Objective Test",
      shortLabel: match ? match[1].replace("OT", "OT#") : baseMeta.shortLabel,
    };
  }

  if (/^FBLC_StudyGuide\d+_Bank\.md$/i.test(fileName)) {
    const match = fileName.match(/^FBLC_StudyGuide(\d+)_Bank\.md$/i);
    return {
      ...baseMeta,
      categoryId: "study-guide",
      categoryLabel: "Study Guide",
      shortLabel: match ? `Study Guide ${match[1]}` : baseMeta.shortLabel,
    };
  }

  if (/^FBLC_[A-Z]+_Competency_Specific_Test_Bank\.md$/i.test(fileName)) {
    const match = fileName.match(/^FBLC_([A-Z]+)_Competency_Specific_Test_Bank\.md$/i);
    return {
      ...baseMeta,
      categoryId: "competency-test",
      categoryLabel: "Competency Test",
      shortLabel: match ? `${match[1]} Competency` : baseMeta.shortLabel,
    };
  }

  if (/^FBLA_Sample\d+_Bank\.md$/i.test(fileName)) {
    const match = fileName.match(/^FBLA_Sample(\d+)_Bank\.md$/i);
    return {
      ...baseMeta,
      categoryId: "sample-bank",
      categoryLabel: "Sample Bank",
      shortLabel: match ? `Sample ${match[1]}` : baseMeta.shortLabel,
    };
  }

  return baseMeta;
}

function parseStatusNotes(lines) {
  const notes = [];
  const statusStart = lines.findIndex((line) => /^Status:\s*$/i.test(line.trim()));

  if (statusStart === -1) {
    return notes;
  }

  for (let index = statusStart + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^##\s+/.test(line)) break;
    if (/^-\s+/.test(line)) notes.push(line.replace(/^-+\s*/, "").trim());
  }

  return notes;
}

function getPreferredCategoryIds(fileName) {
  for (const grouped of GROUPED_BANK_CANDIDATES) {
    if (grouped.regex.test(fileName)) {
      return grouped.categoryIds;
    }
  }
  return [];
}

function parseBankFile(fileName, rawContent) {
  const lines = rawContent.replace(/\r/g, "").split("\n");
  const titleLine = lines.find((line) => /^#\s+/.test(line));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : fileName.replace(/\.md$/i, "");
  const statusNotes = parseStatusNotes(lines);
  const bankMeta = deriveBankMeta(fileName, title, statusNotes);
  const preferredCategoryIds = getPreferredCategoryIds(fileName);

  const answerKeyIndex = lines.findIndex((line) => /^##\s+Answer Key/i.test(line.trim()));
  const questionSection = answerKeyIndex >= 0 ? lines.slice(0, answerKeyIndex) : lines;
  const answerSection = answerKeyIndex >= 0 ? lines.slice(answerKeyIndex + 1) : [];
  const answersByNumber = new Map();

  for (const line of answerSection) {
    const match = line.trim().match(/^(\d+)\.\s+([A-D])$/i);
    if (match) answersByNumber.set(Number(match[1]), match[2].toUpperCase());
  }

  const parsedQuestions = [];
  let currentQuestion = null;
  let currentChoice = null;

  const flushCurrentQuestion = () => {
    if (!currentQuestion) return;

    if (currentChoice) {
      currentQuestion.choices.push(currentChoice);
      currentChoice = null;
    }

    const answerOverrideKey = `${fileName}#${currentQuestion.number}`;
    const sourceAnswerLetter = answersByNumber.get(currentQuestion.number) || null;
    const override = ANSWER_OVERRIDES[answerOverrideKey] || null;
    const finalAnswerLetter = override ? override.answerLetter : sourceAnswerLetter;
    const choices = currentQuestion.choices.map((choice) => ({
      id: choice.id,
      text: cleanInline(choice.parts.join(" ")),
    }));
    const correctChoice = choices.find((choice) => choice.id === finalAnswerLetter) || null;

    if (!sourceAnswerLetter) {
      throw new Error(`${fileName} question ${currentQuestion.number} is missing an answer-key letter.`);
    }
    if (!correctChoice) {
      throw new Error(`${fileName} question ${currentQuestion.number} has no matching choice for ${finalAnswerLetter}.`);
    }
    if (choices.length < 2) {
      throw new Error(`${fileName} question ${currentQuestion.number} has too few answer choices.`);
    }

    const questionId = `${bankMeta.id}--q${currentQuestion.number}`;
    const prompt = cleanInline(currentQuestion.promptParts.join(" "));
    const classifierText = `${prompt} ${choices.map((choice) => choice.text).join(" ")}`;

    parsedQuestions.push({
      id: questionId,
      bankId: bankMeta.id,
      bankFileName: fileName,
      bankTitle: bankMeta.title,
      bankCategoryId: bankMeta.categoryId,
      bankCategoryLabel: bankMeta.categoryLabel,
      bankShortLabel: bankMeta.shortLabel,
      candidateCategoryIds: ALL_CATEGORY_IDS,
      preferredCategoryIds,
      questionNumber: currentQuestion.number,
      prompt,
      promptNormalized: normalizeText(prompt),
      classifierText,
      classifierTokens: tokenizeForClassifier(classifierText),
      choices,
      answerLetter: finalAnswerLetter,
      correctChoiceText: correctChoice.text,
      correctChoiceNormalized: normalizeText(correctChoice.text),
      sourceAnswerLetter,
      answerAdjusted: Boolean(override),
      answerAdjustmentReason: override ? override.reason : null,
      sourceSignature: `${normalizeText(prompt)}||${choices
        .map((choice) => normalizeText(choice.text))
        .sort()
        .join("|")}`,
      duplicateGroupId: null,
      duplicateGroupSize: 1,
      duplicateBankIds: [],
      duplicateBankLabels: [],
      unresolvedConflict: false,
      categoryId: null,
      categoryLabel: null,
      categoryShortLabel: null,
      categoryConfidence: 0,
      categoryReason: "",
      statusNotes,
    });

    currentQuestion = null;
  };

  for (const rawLine of questionSection) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();

    const questionMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (questionMatch) {
      flushCurrentQuestion();
      currentQuestion = {
        number: Number(questionMatch[1]),
        promptParts: [questionMatch[2].trim()],
        choices: [],
      };
      continue;
    }

    if (!currentQuestion) continue;
    if (/^##\s+/.test(trimmed) || /^Status:\s*$/i.test(trimmed) || /^-\s+/.test(trimmed)) continue;

    const choiceMatch = line.match(/^\s*([a-d])\.\s+(.*)$/i);
    if (choiceMatch) {
      if (currentChoice) currentQuestion.choices.push(currentChoice);
      currentChoice = {
        id: choiceMatch[1].toUpperCase(),
        parts: [choiceMatch[2].trim()],
      };
      continue;
    }

    if (!trimmed) continue;
    if (currentChoice) currentChoice.parts.push(trimmed);
    else currentQuestion.promptParts.push(trimmed);
  }

  flushCurrentQuestion();

  return {
    bankMeta,
    questions: parsedQuestions,
  };
}

function annotateDuplicates(questions) {
  const bySignature = new Map();

  for (const question of questions) {
    const list = bySignature.get(question.sourceSignature) || [];
    list.push(question);
    bySignature.set(question.sourceSignature, list);
  }

  const duplicateGroups = [];
  const unresolvedConflictGroups = [];

  for (const [signature, group] of bySignature.entries()) {
    if (group.length < 2) continue;

    const correctAnswers = [...new Set(group.map((question) => question.correctChoiceNormalized))];
    const duplicateGroupId = `dup-${toSlug(signature).slice(0, 48)}`;
    const bankIds = [...new Set(group.map((question) => question.bankId))];
    const bankLabels = [...new Set(group.map((question) => question.bankShortLabel))];

    for (const question of group) {
      question.duplicateGroupId = duplicateGroupId;
      question.duplicateGroupSize = group.length;
      question.duplicateBankIds = bankIds;
      question.duplicateBankLabels = bankLabels;
    }

    duplicateGroups.push({
      id: duplicateGroupId,
      size: group.length,
      bankIds,
      bankLabels,
      questionIds: group.map((question) => question.id),
      prompt: group[0].prompt,
      correctChoiceTexts: [...new Set(group.map((question) => question.correctChoiceText))],
      unresolvedConflict: correctAnswers.length > 1,
    });

    if (correctAnswers.length > 1) {
      unresolvedConflictGroups.push(group);
      for (const question of group) question.unresolvedConflict = true;
    }
  }

  return { duplicateGroups, unresolvedConflictGroups };
}

function scoreQuestionAgainstCategory(question, categoryId) {
  const category = CATEGORY_BY_ID.get(categoryId);
  const promptText = question.prompt;
  const correctChoiceText = question.correctChoiceText;
  const distractorText = question.choices
    .filter((choice) => choice.id !== question.answerLetter)
    .map((choice) => choice.text)
    .join(" ");
  const promptTokenSet = new Set(tokenizeForClassifier(promptText));
  const correctTokenSet = new Set(tokenizeForClassifier(correctChoiceText));
  const distractorTokenSet = new Set(tokenizeForClassifier(distractorText));
  let score = 0;
  const reasons = [];

  for (const pattern of category.patterns) {
    if (pattern.regex.test(promptText)) {
      score += pattern.weight * 1.25;
      reasons.push(`prompt:${pattern.regex.source}`);
    }

    if (pattern.regex.test(correctChoiceText)) {
      score += pattern.weight * 0.9;
      reasons.push(`answer:${pattern.regex.source}`);
    }

    if (pattern.regex.test(distractorText)) {
      score += pattern.weight * 0.2;
    }
  }

  const categoryTokens = CATEGORY_CORPUS_TOKENS.get(categoryId);
  let promptTokenHits = 0;
  let correctTokenHits = 0;
  let distractorTokenHits = 0;
  for (const token of promptTokenSet) {
    if (categoryTokens.has(token)) promptTokenHits += 1;
  }
  for (const token of correctTokenSet) {
    if (categoryTokens.has(token)) correctTokenHits += 1;
  }
  for (const token of distractorTokenSet) {
    if (categoryTokens.has(token)) distractorTokenHits += 1;
  }
  if (promptTokenHits > 0) {
    score += promptTokenHits * 0.75;
  }
  if (correctTokenHits > 0) {
    score += correctTokenHits * 0.45;
  }
  if (distractorTokenHits > 0) {
    score += Math.min(distractorTokenHits, 2) * 0.08;
  }

  if (question.preferredCategoryIds.includes(categoryId)) {
    score += 0.45;
  }

  if (question.bankFileName.startsWith("FBLC_StudyGuide") && categoryId === "A" && /\b(world trade organization|wto|nafta|usmca|gatt|mercosur)\b/i.test(promptText)) {
    score -= 1.5;
  }

  return {
    categoryId,
    score,
    reasons,
  };
}

function classifyQuestion(question) {
  const overrideKey = `${question.bankFileName}#${question.questionNumber}`;
  const manualOverride = CATEGORY_OVERRIDES[overrideKey];
  if (manualOverride) {
    const category = CATEGORY_BY_ID.get(manualOverride);
    return {
      categoryId: category.id,
      categoryLabel: category.label,
      categoryShortLabel: category.shortLabel,
      categoryConfidence: 999,
      categoryReason: "manual_override",
      scoreBreakdown: [{ categoryId: category.id, score: 999 }],
    };
  }

  const candidateIds = question.candidateCategoryIds;
  const scored = candidateIds
    .map((categoryId) => scoreQuestionAgainstCategory(question, categoryId))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1] || { score: 0 };
  const chosenCategory = CATEGORY_BY_ID.get(best.categoryId);

  return {
    categoryId: chosenCategory.id,
    categoryLabel: chosenCategory.label,
    categoryShortLabel: chosenCategory.shortLabel,
    categoryConfidence: Number((best.score - second.score).toFixed(2)),
    categoryReason: best.reasons.slice(0, 4).join(" | ") || "token_overlap",
    scoreBreakdown: scored.map((entry) => ({ categoryId: entry.categoryId, score: Number(entry.score.toFixed(2)) })),
  };
}

function classifyQuestions(questions) {
  for (const question of questions) {
    const classified = classifyQuestion(question);
    question.categoryId = classified.categoryId;
    question.categoryLabel = classified.categoryLabel;
    question.categoryShortLabel = classified.categoryShortLabel;
    question.categoryConfidence = classified.categoryConfidence;
    question.categoryReason = classified.categoryReason;
    question.categoryScoreBreakdown = classified.scoreBreakdown;
  }
}

function buildCategorySummary(questions) {
  return CATEGORY_ORDER.map((category) => ({
    id: category.id,
    label: category.label,
    shortLabel: category.shortLabel,
    officialCount: category.officialCount,
    availableQuestionCount: questions.filter((question) => question.categoryId === category.id).length,
  }));
}

async function buildQuestionBank() {
  const workspaceEntries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  const bankFiles = workspaceEntries
    .filter((entry) => entry.isFile() && /_Bank\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const banks = [];
  const questions = [];

  for (const fileName of bankFiles) {
    const fullPath = path.join(workspaceRoot, fileName);
    const rawContent = await fs.readFile(fullPath, "utf8");
    const parsed = parseBankFile(fileName, rawContent);
    banks.push(parsed.bankMeta);
    questions.push(...parsed.questions);
  }

  const { duplicateGroups, unresolvedConflictGroups } = annotateDuplicates(questions);

  if (unresolvedConflictGroups.length > 0) {
    const sample = unresolvedConflictGroups.slice(0, 5).map((group) =>
      group.map((question) => `${question.bankShortLabel} #${question.questionNumber} -> ${question.answerLetter}`),
    );
    throw new Error(`Unresolved duplicate-answer conflicts remain after overrides: ${JSON.stringify(sample)}`);
  }

  classifyQuestions(questions);

  const categorySummary = buildCategorySummary(questions);
  const missingCategories = categorySummary.filter((category) => category.availableQuestionCount < category.officialCount);
  if (missingCategories.length > 0) {
    throw new Error(`Official simulation cannot be built because some categories are undersupplied: ${JSON.stringify(missingCategories)}`);
  }

  const banksWithCounts = banks.map((bank) => ({
    ...bank,
    questionCount: questions.filter((question) => question.bankId === bank.id).length,
  }));

  const lowConfidenceQuestions = questions
    .filter((question) => question.categoryConfidence < 1.5)
    .sort((left, right) => left.categoryConfidence - right.categoryConfidence)
    .slice(0, 120)
    .map((question) => ({
      id: question.id,
      bankShortLabel: question.bankShortLabel,
      questionNumber: question.questionNumber,
      prompt: question.prompt,
      categoryId: question.categoryId,
      categoryConfidence: question.categoryConfidence,
      scoreBreakdown: question.categoryScoreBreakdown,
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    corpusId: "fbla-international-business-practice",
    version: 2,
    officialSimulation: {
      questionCount: 100,
      timerMinutes: 50,
      categoryCounts: CATEGORY_ORDER.map((category) => ({
        id: category.id,
        label: category.label,
        shortLabel: category.shortLabel,
        count: category.officialCount,
      })),
    },
    summary: {
      totalBanks: banksWithCounts.length,
      totalQuestions: questions.length,
      duplicateGroupCount: duplicateGroups.length,
      duplicatedQuestionCount: duplicateGroups.reduce((sum, group) => sum + group.size, 0),
      answerAdjustments: Object.entries(ANSWER_OVERRIDES).map(([key, value]) => ({
        key,
        answerLetter: value.answerLetter,
        reason: value.reason,
      })),
      categorySummary,
    },
    categories: CATEGORY_ORDER.map((category) => ({
      id: category.id,
      label: category.label,
      shortLabel: category.shortLabel,
      officialCount: category.officialCount,
    })),
    banks: banksWithCounts,
    duplicateGroups,
    questions: questions.map((question) => {
      const { classifierTokens, classifierText, categoryScoreBreakdown, candidateCategoryIds, ...cleanQuestion } = question;
      return cleanQuestion;
    }),
  };

  const report = {
    generatedAt: payload.generatedAt,
    officialSimulation: payload.officialSimulation,
    summary: payload.summary,
    banks: banksWithCounts.map((bank) => ({
      fileName: bank.fileName,
      shortLabel: bank.shortLabel,
      categoryLabel: bank.categoryLabel,
      questionCount: bank.questionCount,
    })),
    categoryCountsByBank: banksWithCounts.map((bank) => ({
      bankId: bank.id,
      shortLabel: bank.shortLabel,
      categories: CATEGORY_ORDER.map((category) => ({
        id: category.id,
        count: questions.filter((question) => question.bankId === bank.id && question.categoryId === category.id).length,
      })).filter((entry) => entry.count > 0),
    })),
    adjustedQuestions: questions
      .filter((question) => question.answerAdjusted)
      .map((question) => ({
        id: question.id,
        bankShortLabel: question.bankShortLabel,
        questionNumber: question.questionNumber,
        sourceAnswerLetter: question.sourceAnswerLetter,
        answerLetter: question.answerLetter,
        reason: question.answerAdjustmentReason,
      })),
    lowConfidenceQuestions,
  };

  const questionBankOutput = `window.FBLAIntlLoader = ${JSON.stringify(payload, null, 2)};\n`;
  const reportOutput = `${JSON.stringify(report, null, 2)}\n`;

  await fs.writeFile(path.join(appRoot, "question_bank_compiled.js"), questionBankOutput, "utf8");
  await fs.writeFile(path.join(appRoot, "compile_report.json"), reportOutput, "utf8");
}

buildQuestionBank().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
