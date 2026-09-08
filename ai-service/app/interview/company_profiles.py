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
    "microsoft": CompanyProfile(
        key="microsoft",
        name="Microsoft",
        style=(
            "Collaborative and growth-mindset oriented. Expects clear communication, "
            "customer empathy, and pragmatic engineering over cleverness."
        ),
        focus_areas=['growth mindset', 'collaboration', 'customer empathy', 'pragmatic design'],
        stage_topics={
            "behavioral": "learning from failure and cross-team collaboration",
            "coding": "clean, well-tested problem solving with clear reasoning",
            "system_design": "pragmatic distributed systems and cloud-scale services",
            "core_cs": "operating systems, networking and cloud fundamentals",
        },
        difficulty_calibration={
            "easy": (
                "SDE I bar: straightforward collaboration stories, core data structures, "
                "simple service designs with clear component boundaries."
            ),
            "medium": (
                "SDE II bar: cross-team influence, medium algorithms, multi-service designs "
                "with availability and cost trade-offs on Azure-scale infrastructure."
            ),
            "hard": (
                "Senior/Principal bar: org-level ambiguity, hard algorithmic depth, "
                "large distributed systems with reliability, migration and tenancy concerns."
            ),
        },
    ),
    "uber": CompanyProfile(
        key="uber",
        name="Uber",
        style=(
            "Pragmatic and operations-heavy. Expects reasoning about real-time systems, "
            "geospatial scale, and what happens when things fail in production."
        ),
        focus_areas=['real-time systems', 'reliability', 'geospatial scale', 'operational rigour'],
        stage_topics={
            "behavioral": "operating under pressure and production ownership",
            "coding": "practical algorithms with latency awareness",
            "system_design": "real-time marketplace, dispatch and geospatial systems",
            "core_cs": "concurrency, queuing and distributed coordination",
        },
        difficulty_calibration={
            "easy": (
                "Entry bar: clear incident stories, core data structures, simple request flows."
            ),
            "medium": (
                "L4/L5 bar: matching and dispatch design, latency budgets, "
                "partial failure handling and backpressure."
            ),
            "hard": (
                "Senior bar: multi-region consistency, surge and hotspot handling, "
                "degradation strategy under regional failure."
            ),
        },
    ),
    "bloomberg": CompanyProfile(
        key="bloomberg",
        name="Bloomberg",
        style=(
            "Rigorous and detail-focused. Expects correctness, precision with data, "
            "and careful reasoning about latency and financial-grade reliability."
        ),
        focus_areas=['correctness', 'low latency', 'data integrity', 'robust engineering'],
        stage_topics={
            "behavioral": "attention to detail and handling high-stakes correctness",
            "coding": "precise algorithms with careful edge-case handling",
            "system_design": "low-latency data distribution and market data systems",
            "core_cs": "data structures, memory and networking fundamentals",
        },
        difficulty_calibration={
            "easy": (
                "Entry bar: careful implementation, core structures, simple pipeline designs."
            ),
            "medium": (
                "Mid bar: performance-sensitive algorithms, streaming data systems, "
                "consistency and ordering guarantees."
            ),
            "hard": (
                "Senior bar: microsecond-level latency reasoning, fault tolerance in "
                "financial data paths, correctness under partial failure."
            ),
        },
    ),
    "adobe": CompanyProfile(
        key="adobe",
        name="Adobe",
        style=(
            "Product-and-craft oriented. Expects thoughtful API design, performance on "
            "large media workloads, and empathy for creative users."
        ),
        focus_areas=['craft', 'performance', 'API design', 'user empathy'],
        stage_topics={
            "behavioral": "craft, quality and cross-functional collaboration",
            "coding": "algorithmic problem solving with attention to performance",
            "system_design": "media processing pipelines and large-asset services",
            "core_cs": "memory, graphics and systems fundamentals",
        },
        difficulty_calibration={
            "easy": (
                "Entry bar: clean implementation, core structures, simple service designs."
            ),
            "medium": (
                "Mid bar: performance-aware algorithms, asset pipelines, caching and "
                "storage trade-offs for large binaries."
            ),
            "hard": (
                "Senior bar: distributed media processing at scale, cost and latency "
                "trade-offs, multi-tenant reliability."
            ),
        },
    ),
    "linkedin": CompanyProfile(
        key="linkedin",
        name="LinkedIn",
        style=(
            "Data and graph oriented. Expects reasoning about social graphs, feed "
            "relevance, and systems that serve personalised content at scale."
        ),
        focus_areas=['graph systems', 'relevance', 'data infrastructure', 'scalability'],
        stage_topics={
            "behavioral": "collaboration, mentorship and long-term impact",
            "coding": "graph and data-heavy problem solving",
            "system_design": "social graph, feed and recommendation infrastructure",
            "core_cs": "distributed storage, streaming and indexing fundamentals",
        },
        difficulty_calibration={
            "easy": (
                "Entry bar: clear stories, core structures, simple read paths."
            ),
            "medium": (
                "Mid bar: graph traversal at scale, feed fan-out trade-offs, "
                "stream processing and near-line systems."
            ),
            "hard": (
                "Senior bar: relevance infrastructure, multi-datacentre consistency, "
                "cost and freshness trade-offs in large-scale serving."
            ),
        },
    ),
    "airbnb": CompanyProfile(
        key="airbnb",
        name="Airbnb",
        style=(
            "Values-driven and product-minded. Expects host and guest empathy, "
            "clear trade-off articulation, and pragmatic full-stack reasoning."
        ),
        focus_areas=['product thinking', 'trust and safety', 'pragmatism', 'clear communication'],
        stage_topics={
            "behavioral": "values alignment, belonging and user empathy",
            "coding": "practical problem solving with product context",
            "system_design": "marketplace, search and booking systems",
            "core_cs": "data modelling, consistency and service fundamentals",
        },
        difficulty_calibration={
            "easy": (
                "Entry bar: clear product reasoning, core structures, simple booking flows."
            ),
            "medium": (
                "Mid bar: search and availability systems, pricing pipelines, "
                "consistency in a two-sided marketplace."
            ),
            "hard": (
                "Senior bar: global marketplace scale, trust and safety systems, "
                "double-booking prevention under concurrency."
            ),
        },
    ),
}


def get_company_profile(company: str) -> CompanyProfile:
    normalized = company.strip().lower()
    if normalized not in COMPANY_PROFILES:
        raise ValueError("company must be one of: " + ", ".join(sorted(COMPANY_PROFILES)))
    return COMPANY_PROFILES[normalized]


def get_difficulty_calibration(company: str, difficulty: str) -> str:
    """Short prompt modifier for RAG query and LLM (easy | medium | hard)."""
    profile = get_company_profile(company)
    key = difficulty.strip().lower()
    return profile.difficulty_calibration.get(key, profile.difficulty_calibration.get("medium", ""))
