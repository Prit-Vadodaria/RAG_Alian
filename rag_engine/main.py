"""Application bootstrap for the Website RAG project."""

from __future__ import annotations

import os

os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import argparse
import logging
import sys
from pathlib import Path

from src.config.logging_config import configure_logging
from src.config.settings import settings
from src.ingestion.crawler import crawl_urls, read_urls
from src.ingestion.sitemap import filter_urls_by_language, parse_and_save_sitemap, save_urls
from src.evaluation.benchmark import benchmark_results_to_json, run_embedding_benchmark
from src.ingestion.pipeline import process_raw_html_directory
from src.retrieval.reranker import Reranker
from src.vectordb.chroma_store import index_exported_chunks
from src.vectordb.retrieval import search_index
from src.rag.rag_pipeline import RagPipeline


def main() -> None:
    """Initialize the project or run Phase 1 sitemap ingestion."""
    _configure_output_encoding()
    if "--ask" in sys.argv:
        configure_logging(level=logging.ERROR)
    else:
        configure_logging()
    parser = argparse.ArgumentParser(description="Website RAG pipeline bootstrap")
    parser.add_argument(
        "--sitemap-url",
        help="Parse a sitemap and save extracted URLs for Phase 1.",
    )
    parser.add_argument(
        "--language",
        help="Optional language path prefix to keep, such as en or hi.",
    )
    parser.add_argument(
        "--filter-existing-urls",
        action="store_true",
        help="Filter the existing saved URL file instead of fetching a sitemap.",
    )
    parser.add_argument(
        "--crawl-urls",
        action="store_true",
        help="Crawl saved Phase 1 URLs and store raw rendered HTML snapshots.",
    )
    parser.add_argument(
        "--allowed-domain",
        action="append",
        dest="allowed_domains",
        help="Restrict crawling to this domain. Repeat for multiple domains.",
    )
    parser.add_argument(
        "--ignore-robots",
        action="store_true",
        help="Disable robots.txt checks while crawling.",
    )
    parser.add_argument(
        "--crawl-delay",
        type=float,
        help="Seconds to wait between requests to the same host.",
    )
    parser.add_argument(
        "--crawl-workers",
        type=int,
        default=1,
        help="Number of independent browser workers for crawling.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Optional maximum number of URLs to process.",
    )
    parser.add_argument(
        "--process-html",
        action="store_true",
        help="Convert raw HTML files into cleaned markdown, structured docs, and chunks.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes for HTML processing.",
    )
    parser.add_argument(
        "--index-chunks",
        action="store_true",
        help="Embed exported chunks and store them in the local Chroma index.",
    )
    parser.add_argument(
        "--query",
        help="Search the local Chroma index for relevant chunks.",
    )
    parser.add_argument(
        "--ask",
        help="Retrieve relevant chunks and generate a grounded answer with the local LLM.",
    )
    parser.add_argument(
        "--warmup-reranker",
        action="store_true",
        help="Preload the reranker model into the in-process cache and exit.",
    )
    parser.add_argument(
        "--benchmark-embeddings",
        action="store_true",
        help="Benchmark candidate embedding models on local chunks.",
    )
    parser.add_argument(
        "--benchmark-model",
        action="append",
        dest="benchmark_models",
        help="Embedding model to benchmark. Repeat for multiple models.",
    )
    parser.add_argument(
        "--benchmark-query-file",
        help="Optional JSON file with query and expected_terms entries.",
    )
    parser.add_argument(
        "--benchmark-sample-size",
        type=int,
        default=250,
        help="Maximum chunks to use for embedding benchmarks.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of search results to return for --query.",
    )
    args = parser.parse_args()

    if args.filter_existing_urls:
        if not args.language:
            parser.error("--filter-existing-urls requires --language")

        existing_urls = settings.SITEMAP_URLS_FILE.read_text(encoding="utf-8").splitlines()
        filtered_urls = filter_urls_by_language(existing_urls, args.language)
        save_urls(filtered_urls, settings.SITEMAP_URLS_FILE)
        print(f"Filtered {len(existing_urls)} URLs down to {len(filtered_urls)} {args.language} URLs.")
        print(f"Saved URL list: {settings.SITEMAP_URLS_FILE}")
        return

    if args.sitemap_url:
        urls = parse_and_save_sitemap(args.sitemap_url, language=args.language)
        label = f"{args.language} URLs" if args.language else "URLs"
        print(f"Extracted {len(urls)} {label}.")
        print(f"Saved URL list: {settings.SITEMAP_URLS_FILE}")
        return

    if args.crawl_urls:
        urls = read_urls(settings.SITEMAP_URLS_FILE)
        results = crawl_urls(
            urls,
            limit=args.limit,
            allowed_domains=args.allowed_domains,
            respect_robots=settings.RESPECT_ROBOTS_TXT and not args.ignore_robots,
            crawl_delay_seconds=args.crawl_delay
            if args.crawl_delay is not None
            else settings.CRAWL_DELAY_SECONDS,
            workers=args.crawl_workers,
        )
        success_count = sum(result.success for result in results)
        failure_count = len(results) - success_count
        blocked_domain_count = sum(result.status == "blocked_domain" for result in results)
        blocked_robots_count = sum(result.status == "blocked_robots" for result in results)
        print(f"Crawled {success_count} URLs successfully.")
        print(f"Failed {failure_count} URLs.")
        print(f"Blocked by domain policy: {blocked_domain_count}")
        print(f"Blocked by robots.txt: {blocked_robots_count}")
        print(f"Saved raw HTML directory: {settings.RAW_HTML_DIR}")
        print(f"Crawl audit log: {settings.CRAWL_AUDIT_FILE}")
        print(f"Crawl manifest: {settings.CRAWL_MANIFEST_FILE}")
        return

    if args.process_html:
        summary = process_raw_html_directory(limit=args.limit, workers=args.workers)
        print(f"Processed documents: {summary.processed_documents}")
        print(f"Exported chunks: {summary.exported_chunks}")
        print(f"Skipped duplicates: {summary.skipped_duplicates}")
        print(f"Empty pages: {summary.empty_pages}")
        print(f"Failed pages: {summary.failed_pages}")
        print(f"Cleaned markdown directory: {summary.cleaned_markdown_dir}")
        print(f"Structured docs directory: {summary.structured_docs_dir}")
        print(f"Chunks directory: {summary.chunks_dir}")
        return

    if args.index_chunks:
        summary = index_exported_chunks()
        print(f"Loaded chunks: {summary.loaded_chunks}")
        print(f"Indexed chunks: {summary.indexed_chunks}")
        print(f"Collection: {summary.collection_name}")
        print(f"Chroma directory: {summary.chroma_dir}")
        return

    if args.warmup_reranker:
        _warmup_reranker()
        return

    if args.query:
        results = search_index(args.query, top_k=args.top_k)
        print(f"Query: {args.query}")
        print(f"Results: {len(results)}")
        if not results:
            print("I don't know based on the indexed website content.")
            return

        for index, result in enumerate(results, start=1):
            title = result.metadata.get("title", "")
            url = result.metadata.get("url", "")
            section = result.metadata.get("section", "")
            distance = f"{result.distance:.4f}" if result.distance is not None else "n/a"
            preview = " ".join(result.content.split())[:500]
            print()
            print(f"{index}. {title}")
            print(f"   URL: {url}")
            print(f"   Section: {section}")
            print(f"   Distance: {distance}")
            print(f"   Chunk: {result.chunk_id}")
            print(f"   Preview: {preview}")
        return

    if args.ask:
        _warmup_reranker()
        rag_result = RagPipeline(final_top_k=args.top_k).run(args.ask)
        print(f"Question: {rag_result.query}")
        print()
        print(rag_result.answer)
        print()
        print(f"Confidence: {rag_result.confidence:.2f} ({rag_result.confidence_label})")
        print(
            "Breakdown: "
            f"retrieval={rag_result.confidence_breakdown['retrieval']:.2f}, "
            f"rerank={rag_result.confidence_breakdown['rerank']:.2f}, "
            f"grounding={rag_result.confidence_breakdown['grounding']:.2f}, "
            f"answer_quality={rag_result.confidence_breakdown['answer_quality']:.2f}"
        )
        print()
        print()
        print("Metrics:")
        print(f"  Total latency: {rag_result.metrics.total_latency_ms:.1f} ms")
        print(f"  Retrieval latency: {rag_result.metrics.retrieval_latency_ms:.1f} ms")
        print(f"  Rerank latency: {rag_result.metrics.rerank_latency_ms:.1f} ms")
        print(f"  Generation latency: {rag_result.metrics.generation_latency_ms:.1f} ms")
        print(f"  Input tokens: {rag_result.metrics.input_tokens}")
        print(f"  Output tokens: {rag_result.metrics.output_tokens}")
        print(f"  Total tokens: {rag_result.metrics.total_tokens}")
        print(
            f"  Throughput: "
            f"{rag_result.metrics.throughput_tokens_per_second:.2f} tokens/sec"
        )        

        if rag_result.sources:
            print()
            print("Sources:")
            for source in rag_result.sources:
                print(f"- [{source.source_id}] {source.title} | {source.section} | {source.url}")
        return
           

    if args.benchmark_embeddings:
        results = run_embedding_benchmark(
            models=args.benchmark_models,
            query_file=Path(args.benchmark_query_file) if args.benchmark_query_file else None,
            sample_size=args.benchmark_sample_size,
            top_k=args.top_k,
        )
        print(benchmark_results_to_json(results))
        return

    print("Website RAG project initialized.")
    print(f"Base directory: {settings.BASE_DIR}")
    print(f"Shared workspace directory: {settings.DATA_DIR}")


def _warmup_reranker() -> None:
    if not settings.ENABLE_RERANKER:
        print("Reranker warmup skipped: ENABLE_RERANKER is disabled.")
        return

    reranker = Reranker.warmup(
        model_name=settings.RERANKER_MODEL,
        use_fp16=settings.RERANKER_USE_FP16,
        init_timeout_seconds=settings.RERANKER_INIT_TIMEOUT_SECONDS,
        backend=settings.RERANKER_BACKEND,
    )
    """print(
        "Reranker warmup complete: "
        f"backend={reranker.last_backend} "
        f"status={reranker.last_status} "
        f"load_time_ms={(reranker.last_load_seconds or 0.0) * 1000.0:.1f}"
    )"""


def _configure_output_encoding() -> None:
    """Prefer UTF-8 output for markdown/content previews on Windows consoles."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


if __name__ == "__main__":
    main()
