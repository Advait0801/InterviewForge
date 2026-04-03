from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class CompanyProfile:
    key: str
    name: str
    style: str
    focus_areas: List[str]
    stage_topics: Dict[str, str]
    difficulty_calibration: Dict[str, str]


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
        difficulty_calibration={
            "easy": (
                "Entry-level SDE-style bar: straightforward STAR behavioral stories, "
                "basic data structures and arrays/strings, simple system design sketches with clear trade-offs."
            ),
            "medium": (
                "SDE-II level: deeper Leadership Principle depth, medium algorithms (graphs, heaps, DP), "
                "multi-component system design with scaling and cost awareness."
            ),
            "hard": (
                "Senior/Principal bar: ambiguous ownership and org-level stories, hard algorithmic problems, "
                "large-scale distributed design with reliability, security, and frugality."
            ),
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
        difficulty_calibration={
            "easy": (
                "L3-equivalent: solid fundamentals, brute-force then optimize, clear complexity analysis, "
                "behavioral stories showing collaboration and learning."
            ),
            "medium": (
                "L4-equivalent: non-trivial algorithms (graphs, DP, trees), rigorous proofs of correctness, "
                "system design with back-of-envelope math and alternatives."
            ),
            "hard": (
                "L5+-equivalent: subtle algorithmic optimizations, ambiguous system constraints, "
                "deep distributed-systems and trade-off discussions under scale."
            ),
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
        difficulty_calibration={
            "easy": (
                "E3-style: ship working code quickly, clear communication, behavioral stories with measurable impact, "
                "straightforward system design at high level."
            ),
            "medium": (
                "E4-style: faster iteration under time pressure, medium-hard coding, "
                "real-time and graph-heavy system design with scale numbers."
            ),
            "hard": (
                "E5+-style: ambiguous product-scale problems, deep performance and consistency trade-offs, "
                "leadership and conflict stories under rapid shipping."
            ),
        },
    ),
    "apple": CompanyProfile(
        key="apple",
        name="Apple",
        style=(
            "Emphasize product quality, crisp communication, and practical engineering judgment. "
            "Probe deeply on fundamentals, performance, and user-experience trade-offs."
        ),
        focus_areas=["product quality", "performance", "fundamentals", "execution"],
        stage_topics={
            "behavioral": "ownership, cross-functional collaboration, and product impact",
            "coding": "clean implementation, correctness, and complexity trade-offs",
            "system_design": "reliable user-facing systems with latency and quality focus",
            "core_cs": "strong fundamentals in systems, memory, and concurrency",
        },
        difficulty_calibration={
            "easy": (
                "Solid fundamentals: readable code, careful edge cases, behavioral examples of ownership, "
                "system design with reliability and UX awareness."
            ),
            "medium": (
                "Deeper quality bar: performance-conscious coding, nuanced behavioral trade-offs, "
                "system design with latency, privacy, and operability."
            ),
            "hard": (
                "Senior bar: memory/concurrency depth, ambiguous quality vs schedule decisions, "
                "large-scale systems with security and user trust at the center."
            ),
        },
    ),
}


def get_company_profile(company: str) -> CompanyProfile:
    normalized = company.strip().lower()
    if normalized not in COMPANY_PROFILES:
        raise ValueError("company must be one of: amazon, google, meta, apple")
    return COMPANY_PROFILES[normalized]


def get_difficulty_calibration(company: str, difficulty: str) -> str:
    """Short prompt modifier for RAG query and LLM (easy | medium | hard)."""
    profile = get_company_profile(company)
    key = difficulty.strip().lower()
    return profile.difficulty_calibration.get(key, profile.difficulty_calibration.get("medium", ""))
