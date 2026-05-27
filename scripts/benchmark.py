"""Run embedding benchmark with current evaluation module."""

from __future__ import annotations

from src.evaluation.benchmark import benchmark_results_to_json, run_embedding_benchmark


def main() -> None:
    results = run_embedding_benchmark()
    print(benchmark_results_to_json(results))


if __name__ == "__main__":
    main()
