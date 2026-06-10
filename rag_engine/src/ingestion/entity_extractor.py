"""Generic structured entity extraction from HTML pages.

Extracts structured data that survives cleaning, chunking, and retrieval:
- Products    : name, price, sale price, currency, availability, SKU, variants
- People      : founders, CEOs, executives, team members
- Organization: name, description, founding date
- FAQ         : question/answer pairs
- General     : any schema.org type found in JSON-LD

Data sources (in priority order):
1. JSON-LD <script type="application/ld+json"> blocks
2. Open Graph / Twitter / standard meta tags
3. Microdata (itemscope/itemprop attributes)

All extraction is purely generic — no website-specific rules.
"""

from __future__ import annotations

import json
import re
from typing import Any

from bs4 import BeautifulSoup


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_structured_entities(html: str) -> dict[str, Any]:
    """Return a flat metadata dict of structured entities found in *html*.

    The returned dict is merged into the document/chunk metadata so values
    survive embedding and are available at retrieval time.

    Keys added (only when data is found):
        entity_type         : highest-confidence schema type ("Product", "Person", etc.)
        product_name        : str
        product_price       : str  (e.g. "149.00")
        product_sale_price  : str
        product_currency    : str  (e.g. "AED", "USD")
        product_availability: str  (e.g. "InStock")
        product_sku         : str
        product_variants    : str  (JSON array string)
        product_description : str
        people              : str  (JSON array string of {name, role} objects)
        org_name            : str
        org_description     : str
        faq_pairs           : str  (JSON array string of {q, a} objects)
    """
    if not html:
        return {}

    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, Any] = {}

    # Layer 1 — JSON-LD (most reliable, machine-readable)
    ld_entities = _extract_json_ld(soup)
    _merge(result, ld_entities)

    # Layer 2 — Open Graph / meta tags (fill gaps)
    meta_entities = _extract_meta_tags(soup)
    _merge_missing(result, meta_entities)

    # Layer 3 — Microdata (fill remaining gaps)
    micro_entities = _extract_microdata(soup)
    _merge_missing(result, micro_entities)

    return result


# ---------------------------------------------------------------------------
# JSON-LD extraction
# ---------------------------------------------------------------------------

def _extract_json_ld(soup: BeautifulSoup) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            raw = script.get_text(strip=True)
            if not raw:
                continue
            data = json.loads(raw)
        except (json.JSONDecodeError, Exception):
            continue

        # Handle @graph arrays
        if isinstance(data, dict) and "@graph" in data:
            nodes = data["@graph"] if isinstance(data["@graph"], list) else [data["@graph"]]
            for node in nodes:
                if isinstance(node, dict):
                    _merge(result, _parse_ld_node(node))
        elif isinstance(data, list):
            for node in data:
                if isinstance(node, dict):
                    _merge(result, _parse_ld_node(node))
        elif isinstance(data, dict):
            _merge(result, _parse_ld_node(data))

    return result


def _parse_ld_node(node: dict[str, Any]) -> dict[str, Any]:
    schema_type = _ld_type(node)
    result: dict[str, Any] = {}
    if not schema_type:
        return result

    result["entity_type"] = schema_type

    if schema_type == "Product":
        result.update(_parse_product(node))
    elif schema_type in {"Person", "Employee"}:
        result.update(_parse_person(node))
    elif schema_type in {"Organization", "Corporation", "LocalBusiness", "SoftwareApplication"}:
        result.update(_parse_org(node))
    elif schema_type == "FAQPage":
        result.update(_parse_faq(node))
    elif schema_type == "BreadcrumbList":
        pass  # not useful for retrieval
    else:
        # Generic fallback — capture name and description for any type
        name = _ld_str(node, "name")
        description = _ld_str(node, "description")
        if name:
            result["org_name"] = name
        if description:
            result["org_description"] = description

    return result


def _parse_product(node: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    name = _ld_str(node, "name")
    if name:
        result["product_name"] = name

    description = _ld_str(node, "description")
    if description:
        result["product_description"] = description[:500]

    sku = _ld_str(node, "sku") or _ld_str(node, "productID")
    if sku:
        result["product_sku"] = sku

    # Offers — can be a single object or a list
    offers = node.get("offers")
    if isinstance(offers, dict):
        offers = [offers]
    if isinstance(offers, list) and offers:
        first = offers[0]
        price = _ld_str(first, "price") or _ld_str(first, "lowPrice")
        if price:
            result["product_price"] = _clean_price(price)
        currency = _ld_str(first, "priceCurrency")
        if currency:
            result["product_currency"] = currency.upper()
        availability = _ld_str(first, "availability")
        if availability:
            result["product_availability"] = _simplify_availability(availability)
        sale_price = _ld_str(first, "salePrice")
        if sale_price:
            result["product_sale_price"] = _clean_price(sale_price)

        # Multiple offers = variants
        if len(offers) > 1:
            variants = []
            for offer in offers:
                v: dict[str, str] = {}
                v_name = _ld_str(offer, "name") or _ld_str(offer, "description")
                v_price = _ld_str(offer, "price")
                v_avail = _ld_str(offer, "availability")
                if v_name:
                    v["name"] = v_name
                if v_price:
                    v["price"] = _clean_price(v_price)
                if v_avail:
                    v["availability"] = _simplify_availability(v_avail)
                if v:
                    variants.append(v)
            if variants:
                result["product_variants"] = json.dumps(variants, ensure_ascii=False)

    return result


def _parse_person(node: dict[str, Any]) -> dict[str, Any]:
    name = _ld_str(node, "name")
    if not name:
        return {}
    role = (
        _ld_str(node, "jobTitle")
        or _ld_str(node, "roleName")
        or _ld_str(node, "@type")
        or ""
    )
    person = {"name": name, "role": role}
    return {"people": json.dumps([person], ensure_ascii=False)}


def _parse_org(node: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    name = _ld_str(node, "name") or _ld_str(node, "legalName")
    if name:
        result["org_name"] = name
    description = _ld_str(node, "description")
    if description:
        result["org_description"] = description[:500]

    # Founders / employees embedded in the org node
    people: list[dict[str, str]] = []
    for key in ("founder", "founders", "employee", "employees", "member", "members"):
        raw = node.get(key)
        if raw is None:
            continue
        if isinstance(raw, dict):
            raw = [raw]
        if isinstance(raw, list):
            for person_node in raw:
                if not isinstance(person_node, dict):
                    continue
                p_name = _ld_str(person_node, "name")
                p_role = _ld_str(person_node, "jobTitle") or key.rstrip("s").title()
                if p_name:
                    people.append({"name": p_name, "role": p_role})
    if people:
        result["people"] = json.dumps(people, ensure_ascii=False)
    return result


def _parse_faq(node: dict[str, Any]) -> dict[str, Any]:
    entries = node.get("mainEntity", [])
    if isinstance(entries, dict):
        entries = [entries]
    if not isinstance(entries, list):
        return {}
    pairs: list[dict[str, str]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        question = _ld_str(entry, "name")
        answer_node = entry.get("acceptedAnswer") or {}
        answer = _ld_str(answer_node, "text") if isinstance(answer_node, dict) else ""
        if question and answer:
            pairs.append({"q": question, "a": answer[:400]})
    if pairs:
        return {"faq_pairs": json.dumps(pairs, ensure_ascii=False)}
    return {}


# ---------------------------------------------------------------------------
# Open Graph / meta tag extraction
# ---------------------------------------------------------------------------

def _extract_meta_tags(soup: BeautifulSoup) -> dict[str, Any]:
    result: dict[str, Any] = {}

    def _meta(name: str) -> str:
        tag = (
            soup.find("meta", attrs={"property": name})
            or soup.find("meta", attrs={"name": name})
        )
        return str(tag.get("content", "") if tag else "").strip()

    og_type = _meta("og:type")
    if og_type == "product":
        result["entity_type"] = "Product"
        name = _meta("og:title") or _meta("product:title")
        if name:
            result["product_name"] = name
        price = _meta("product:price:amount") or _meta("og:price:amount")
        if price:
            result["product_price"] = _clean_price(price)
        currency = _meta("product:price:currency") or _meta("og:price:currency")
        if currency:
            result["product_currency"] = currency.upper()
        availability = _meta("product:availability")
        if availability:
            result["product_availability"] = _simplify_availability(availability)

    return result


# ---------------------------------------------------------------------------
# Microdata extraction
# ---------------------------------------------------------------------------

def _extract_microdata(soup: BeautifulSoup) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for item in soup.find_all(attrs={"itemscope": True}):
        item_type = str(item.get("itemtype", "")).lower()
        if "product" in item_type:
            result["entity_type"] = "Product"
            name_tag = item.find(attrs={"itemprop": "name"})
            if name_tag:
                result["product_name"] = name_tag.get_text(strip=True)
            price_tag = item.find(attrs={"itemprop": "price"})
            if price_tag:
                price = price_tag.get("content") or price_tag.get_text(strip=True)
                result["product_price"] = _clean_price(str(price))
            currency_tag = item.find(attrs={"itemprop": "priceCurrency"})
            if currency_tag:
                result["product_currency"] = (
                    currency_tag.get("content") or currency_tag.get_text(strip=True)
                ).upper()
            avail_tag = item.find(attrs={"itemprop": "availability"})
            if avail_tag:
                result["product_availability"] = _simplify_availability(
                    avail_tag.get("content") or avail_tag.get_text(strip=True)
                )
        elif "person" in item_type:
            name_tag = item.find(attrs={"itemprop": "name"})
            role_tag = item.find(attrs={"itemprop": "jobTitle"})
            if name_tag:
                p = {"name": name_tag.get_text(strip=True)}
                if role_tag:
                    p["role"] = role_tag.get_text(strip=True)
                result["people"] = json.dumps([p], ensure_ascii=False)

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ld_str(node: dict[str, Any], key: str) -> str:
    value = node.get(key, "")
    if isinstance(value, dict):
        value = value.get("@value") or value.get("name") or ""
    return str(value or "").strip()


def _ld_type(node: dict[str, Any]) -> str:
    t = node.get("@type", "")
    if isinstance(t, list):
        t = t[0] if t else ""
    # Strip schema.org namespace prefix if present
    return str(t or "").split("/")[-1].strip()


def _clean_price(price: str) -> str:
    """Normalise price strings: strip currency symbols, keep digits and decimal."""
    cleaned = re.sub(r"[^\d.,]", "", str(price or "").strip())
    # Normalise European decimal comma → period
    if cleaned.count(",") == 1 and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    return cleaned.strip(".,") or price.strip()


def _simplify_availability(availability: str) -> str:
    """Reduce schema.org URL values to a short human label."""
    mapping = {
        "instock": "InStock",
        "outofstock": "OutOfStock",
        "preorder": "PreOrder",
        "discontinued": "Discontinued",
        "limitedavailability": "LimitedAvailability",
        "onlineonly": "OnlineOnly",
        "soldout": "OutOfStock",
    }
    key = re.sub(r"[^a-z]", "", str(availability or "").lower())
    return mapping.get(key, availability.strip())


def _merge(target: dict[str, Any], source: dict[str, Any]) -> None:
    """Merge source into target, overwriting existing keys."""
    target.update(source)


def _merge_missing(target: dict[str, Any], source: dict[str, Any]) -> None:
    """Merge source into target only for keys not already present."""
    for k, v in source.items():
        if k not in target:
            target[k] = v