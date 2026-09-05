"""
Standalone test runner for Personal Knowledge Assistant.
Can be executed via standard python without requiring pytest:
    python run_tests.py
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tests.test_knowledge_assistant import (
    test_chunk_text_boundaries_and_size,
    test_chunk_overlap_preservation,
    test_deterministic_embedding_normalization,
    test_cosine_similarity_top_match,
    test_sm2_perfect_recall_increases_ef,
    test_sm2_failed_recall_resets_interval,
    test_sm2_minimum_ease_factor_floor,
    test_quiz_evaluation_scoring_and_grading,
    test_local_extractive_answer_cites_source,
)


def run_all():
    tests = [
        ("Chunk Boundaries & Minimum Size", test_chunk_text_boundaries_and_size),
        ("Chunk Overlap Preservation", test_chunk_overlap_preservation),
        ("Vector L2 Normalization", test_deterministic_embedding_normalization),
        ("Cosine Semantic Top Match", test_cosine_similarity_top_match),
        ("SM-2 Perfect Recall Ease Factor Boost", test_sm2_perfect_recall_increases_ef),
        ("SM-2 Failed Recall Interval Reset", test_sm2_failed_recall_resets_interval),
        ("SM-2 Minimum Ease Factor Floor (1.3)", test_sm2_minimum_ease_factor_floor),
        ("AI Quiz Evaluation & Grading", test_quiz_evaluation_scoring_and_grading),
        ("Adaptive AI Extractive Fallback & Citation", test_local_extractive_answer_cites_source),
    ]

    print("=" * 65)
    print("🧠 Personal Knowledge Assistant — Automated Verification Suite")
    print("=" * 65)

    passed = 0
    failed = 0

    for name, fn in tests:
        try:
            fn()
            print(f"  ✅ PASS: {name}")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {name} — {e}")
            failed += 1

    print("-" * 65)
    print(f"Total: {len(tests)} | Passed: {passed} | Failed: {failed}")
    print("=" * 65)

    if failed > 0:
        sys.exit(1)
    else:
        print("🎉 ALL TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)


if __name__ == "__main__":
    run_all()
