export interface SummarySection {
  title: string;
  content: string;
}

export interface DemoSummary {
  patient: {
    name: string | null;
    age: number | null;
    sex: string | null;
    identifiers: string[];
  };
  chief_complaint: string | null;
  history_of_present_illness: {
    onset: string | null;
    duration: string | null;
    progression: string | null;
    aggravating_factors: string[];
    relieving_factors: string[];
  };
  symptoms: {
    positive: string[];
    negative: string[];
  };
  past_medical_history: {
    conditions: string[];
    surgeries: string[];
    hospitalisations: string[];
  };
  medication_history: {
    current_medicines: Array<{
      name: string | null;
      dose: string | null;
      adherence: string | null;
    }>;
    allergies: string[];
  };
  clinical_observations: {
    vitals: Record<string, string>;
    examination_findings: string[];
  };
  assessment: {
    provisional_diagnosis: string | null;
    differentials: string[];
  };
  plan: {
    investigations: string[];
    prescriptions: string[];
    advice: string[];
    follow_up: string | null;
  };
  clinical_summary: string | null;
}

const emptySummary: DemoSummary = {
  patient: {
    name: null,
    age: null,
    sex: null,
    identifiers: []
  },
  chief_complaint: null,
  history_of_present_illness: {
    onset: null,
    duration: null,
    progression: null,
    aggravating_factors: [],
    relieving_factors: []
  },
  symptoms: { positive: [], negative: [] },
  past_medical_history: { conditions: [], surgeries: [], hospitalisations: [] },
  medication_history: { current_medicines: [], allergies: [] },
  clinical_observations: { vitals: {}, examination_findings: [] },
  assessment: { provisional_diagnosis: null, differentials: [] },
  plan: { investigations: [], prescriptions: [], advice: [], follow_up: null },
  clinical_summary: null
};

function createSection(section: SummarySection): HTMLElement {
  const article = document.createElement("article");
  article.className = "summary-section";

  const heading = document.createElement("h3");
  heading.textContent = section.title;
  article.append(heading);

  if (section.title === "Clinical Summary") {
    const textarea = document.createElement("textarea");
    textarea.className = "clinical-summary-input";
    textarea.id = "clinical-summary";
    textarea.setAttribute("aria-label", "Editable clinical summary");
    textarea.placeholder = "AI-generated clinical summary will appear here...";
    textarea.value = section.content;
    article.append(textarea);
    return article;
  }

  const content = document.createElement("p");
  content.className = section.content ? "section-value" : "empty-state";
  content.textContent = section.content || emptyMessage(section.title);
  article.append(content);
  return article;
}

function emptyMessage(title: string): string {
  const messages: Record<string, string> = {
    "Chief Complaints": "No complaints extracted yet",
    Symptoms: "No symptoms extracted yet",
    "Clinical Impression": "No diagnosis inferred",
    Medications: "No medications extracted yet",
    "Examinations & Tests": "No examinations extracted yet",
    Allergies: "No allergies extracted yet",
    "Past Medical History": "No past medical history extracted",
    "History & Follow-up": "No history or follow-up extracted yet"
  };

  return messages[title] ?? "No information extracted yet";
}

function formatList(label: string, values: string[]): string {
  return values.length ? `${label}: ${values.join(", ")}` : "";
}

function formatSummary(summary: DemoSummary): SummarySection[] {
  const history = summary.history_of_present_illness;
  const historyLines = [
    history.onset && `Onset: ${history.onset}`,
    history.duration && `Duration: ${history.duration}`,
    history.progression && `Progression: ${history.progression}`,
    formatList("Aggravating factors", history.aggravating_factors),
    formatList("Relieving factors", history.relieving_factors),
    formatList("Advice", summary.plan.advice),
    summary.plan.follow_up && `Follow-up: ${summary.plan.follow_up}`
  ].filter(Boolean);

  const symptomLines = [
    formatList("Positives", summary.symptoms.positive),
    formatList("Stated negatives", summary.symptoms.negative)
  ].filter(Boolean);

  const medicationLines = summary.medication_history.current_medicines.map((medicine) =>
    [medicine.name, medicine.dose, medicine.adherence && `Adherence: ${medicine.adherence}`]
      .filter(Boolean)
      .join(" — ")
  );
  const observationLines = [
    ...Object.entries(summary.clinical_observations.vitals).map(
      ([name, value]) => `${name}: ${value}`
    ),
    ...summary.clinical_observations.examination_findings
  ];
  const assessmentLines = [
    summary.assessment.provisional_diagnosis,
    formatList("Differentials", summary.assessment.differentials)
  ].filter(Boolean);
  return [
    { title: "Clinical Summary", content: summary.clinical_summary ?? "" },
    { title: "Chief Complaints", content: summary.chief_complaint ?? "" },
    { title: "Symptoms", content: symptomLines.join("\n") },
    { title: "Clinical Impression", content: assessmentLines.join("\n") },
    {
      title: "Medications",
      content: [
        ...medicationLines,
        formatList("Prescriptions", summary.plan.prescriptions)
      ]
        .filter(Boolean)
        .join("\n")
    },
    {
      title: "Examinations & Tests",
      content: [
        ...observationLines,
        formatList("Investigations", summary.plan.investigations)
      ]
        .filter(Boolean)
        .join("\n")
    },
    {
      title: "Allergies",
      content: formatList("Allergies", summary.medication_history.allergies)
    },
    {
      title: "Past Medical History",
      content: [
        formatList("Conditions", summary.past_medical_history.conditions),
        formatList("Surgeries", summary.past_medical_history.surgeries),
        formatList("Hospitalisations", summary.past_medical_history.hospitalisations)
      ]
        .filter(Boolean)
        .join("\n")
    },
    { title: "History & Follow-up", content: historyLines.join("\n") }
  ];
}

export function renderSummary(summary: DemoSummary): void {
  const patientLine = document.querySelector<HTMLElement>("#patient-line");
  const summaryContent = document.querySelector<HTMLElement>("#summary-content");

  if (!patientLine || !summaryContent) {
    throw new Error("A required demo UI element is missing.");
  }

  patientLine.replaceChildren();
  const patientName = document.createElement("strong");
  patientName.textContent = `Patient Name: ${summary.patient.name ?? "Not mentioned"}`;
  const patientDetails = document.createElement("span");
  patientDetails.textContent =
    `Age: ${summary.patient.age ?? "Not mentioned"}  ·  Gender: ${summary.patient.sex ?? "Not mentioned"}`;
  patientLine.append(patientName, patientDetails);

  if (summary.patient.identifiers.length) {
    const identifiers = document.createElement("span");
    identifiers.textContent = `Identifiers: ${summary.patient.identifiers.join(", ")}`;
    patientLine.append(identifiers);
  }

  summaryContent.replaceChildren(
    ...formatSummary(summary).map(createSection)
  );
}

export function renderEmptySummary(): void {
  renderSummary(emptySummary);
}

export function clearTranscript(): void {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  const wordCount = document.querySelector<HTMLElement>("#word-count");
  const chunkCount = document.querySelector<HTMLElement>("#chunk-count");
  if (!transcript || !wordCount || !chunkCount) {
    throw new Error("A required transcript UI element is missing.");
  }

  transcript.replaceChildren();
  wordCount.textContent = "0";
  chunkCount.textContent = "0";
}

export function appendTranscriptChunk(text: string): void {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  const wordCount = document.querySelector<HTMLElement>("#word-count");
  const chunkCount = document.querySelector<HTMLElement>("#chunk-count");
  if (!transcript || !wordCount || !chunkCount) {
    throw new Error("A required transcript UI element is missing.");
  }

  const chunk = document.createElement("p");
  chunk.className = "transcript-chunk";
  const number = document.createElement("span");
  number.className = "chunk-number";
  const chunkNumber = Number(chunkCount.textContent) + 1;
  number.textContent = String(chunkNumber).padStart(2, "0");
  chunk.append(number, document.createTextNode(text));
  transcript.append(chunk);

  const newWords = text.trim().split(/\s+/).filter(Boolean).length;
  wordCount.textContent = String(Number(wordCount.textContent) + newWords);
  chunkCount.textContent = String(chunkNumber);
  transcript.scrollTop = transcript.scrollHeight;
}

export function getTranscriptText(): string {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  if (!transcript) {
    throw new Error("The transcript UI element is missing.");
  }

  return Array.from(transcript.querySelectorAll(".transcript-chunk"))
    .map((chunk) => chunk.lastChild?.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

export function getPrescriptionText(): string {
  const patientLine = document.querySelector<HTMLElement>("#patient-line");
  const summaryContent = document.querySelector<HTMLElement>("#summary-content");
  if (!patientLine || !summaryContent) {
    throw new Error("The summary UI elements are missing.");
  }

  const sections = Array.from(summaryContent.querySelectorAll<HTMLElement>(".summary-section"))
    .map((section) => {
      const title = section.querySelector("h3")?.textContent?.trim() ?? "";
      const textarea = section.querySelector("textarea");
      const content = textarea?.value.trim()
        ?? section.querySelector("p.section-value")?.textContent?.trim()
        ?? "";
      return content ? `${title}\n${content}` : "";
    })
    .filter(Boolean);

  return [patientLine.textContent?.trim() ?? "", ...sections].filter(Boolean).join("\n\n");
}

export function setStatus(message: string, isError = false): void {
  const status = document.querySelector<HTMLElement>("#status-message");
  const statusBox = status?.closest<HTMLElement>(".status-box");
  if (!status || !statusBox) {
    throw new Error("The transcript status element is missing.");
  }
  status.textContent = message;
  statusBox.classList.toggle("is-error", isError);
}

export function setConnectionLabel(message: string): void {
  const badge = document.querySelector<HTMLElement>("#connection-badge");
  if (!badge) {
    throw new Error("The connection badge is missing.");
  }
  const indicator = document.createElement("span");
  badge.replaceChildren(indicator, document.createTextNode(` ${message}`));
}
