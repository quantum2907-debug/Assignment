from pydantic import BaseModel, ConfigDict, Field


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Patient(StrictSchema):
    name: str | None
    age: int | None
    sex: str | None
    identifiers: list[str]


class HistoryOfPresentIllness(StrictSchema):
    onset: str | None
    duration: str | None
    progression: str | None
    aggravating_factors: list[str]
    relieving_factors: list[str]


class Symptoms(StrictSchema):
    positive: list[str]
    negative: list[str]


class PastMedicalHistory(StrictSchema):
    conditions: list[str]
    surgeries: list[str]
    hospitalisations: list[str]


class CurrentMedicine(StrictSchema):
    name: str | None
    dose: str | None
    adherence: str | None


class MedicationHistory(StrictSchema):
    current_medicines: list[CurrentMedicine]
    allergies: list[str]


class ClinicalObservations(StrictSchema):
    vitals: dict[str, str]
    examination_findings: list[str]


class Assessment(StrictSchema):
    provisional_diagnosis: str | None
    differentials: list[str]


class Plan(StrictSchema):
    investigations: list[str]
    prescriptions: list[str]
    advice: list[str]
    follow_up: str | None


class MedicalSummary(StrictSchema):
    patient: Patient
    chief_complaint: str | None
    history_of_present_illness: HistoryOfPresentIllness
    symptoms: Symptoms
    past_medical_history: PastMedicalHistory
    medication_history: MedicationHistory
    clinical_observations: ClinicalObservations
    assessment: Assessment
    plan: Plan
    clinical_summary: str | None = Field(
        description="A concise 3-5 line paragraph for a medical record."
    )


class AnalysisRequest(StrictSchema):
    transcript: str = Field(min_length=1, max_length=100_000)
