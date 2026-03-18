from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class CompanyProfile:
    key: str
    name: str
    style: str
    focus_areas: List[str]
    stage_topics: Dict[str, str]


COMPANY_PROFILES: Dict[str, CompanyProfile] = {
    "amazon": CompanyProfile(
        key="amazon",
        name="Amazon",
        style=(
            "Bias toward ownership, customer obsession, and clear trade-offs. "
            "Push for practical examples, metrics, and leadership-principle style reflection."
        ),
        focus_areas=["ownership", "customer obsession", "trade-offs", "scalability"],
        stage_topics={
            "behavioral": "ownership and customer obsession stories",
            "coding": "problem solving with clear reasoning and edge cases",
            "system_design": "scalable systems with trade-off analysis",
            "core_cs": "fundamentals applied to large-scale production systems",
        },
    ),
    "google": CompanyProfile(
        key="google",
        name="Google",
        style=(
            "Emphasize structured problem solving, algorithmic clarity, and precise reasoning. "
            "Ask open-ended but rigorous questions and reward clean abstractions."
        ),
        focus_areas=["algorithms", "data structures", "clarity", "decomposition"],
        stage_topics={
            "behavioral": "collaboration, ambiguity, and problem-solving process",
            "coding": "algorithms, data structures, and complexity analysis",
            "system_design": "clean system decomposition and capacity reasoning",
            "core_cs": "distributed systems, operating systems, and networking fundamentals",
        },
    ),
    "meta": CompanyProfile(
        key="meta",
        name="Meta",
        style=(
            "Focus on practical coding ability, product-minded trade-offs, and scalability under heavy usage. "
            "Prefer concise questions that test execution and iteration."
        ),
        focus_areas=["execution", "scalability", "practicality", "product sense"],
        stage_topics={
            "behavioral": "execution, teamwork, and shipping impact",
            "coding": "implementation speed, correctness, and edge cases",
            "system_design": "high-scale product systems and bottlenecks",
            "core_cs": "practical systems knowledge and performance trade-offs",
        },
    ),
}


def get_company_profile(company: str) -> CompanyProfile:
    normalized = company.strip().lower()
    if normalized not in COMPANY_PROFILES:
        raise ValueError("company must be one of: amazon, google, meta")
    return COMPANY_PROFILES[normalized]
