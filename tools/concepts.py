# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx", "pydantic"]
# ///
"""Generate concept mockups with gpt-image-2.5-sunburst on OpenRouter.

Each round lives in concepts/<round>/ with its prompts in prompts.toml; images and
manifest.json are written next to it.

uv run tools/concepts.py round-2                # every concept not yet rendered
uv run tools/concepts.py round-2 01 05          # only these (by number prefix or slug)
uv run tools/concepts.py round-2 --force 03     # re-render even if the file exists
"""

import argparse
import asyncio
import base64
import json
import mimetypes
import sys
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = "https://openrouter.ai/api/v1/images"
MODEL = "openai/gpt-image-2.5-sunburst"
QUALITY = "low"
CONCURRENCY = 4


class Concept(BaseModel):
    slug: str
    title: str
    aspect: str
    pitch: str
    prompt: str
    # Images under concepts/ (e.g. "round-8/07-inline-expand.png") the model should stay faithful to.
    references: list[str] = []


class Round(BaseModel):
    base: str
    concept: list[Concept]


class ImageItem(BaseModel):
    b64_json: str | None = None
    url: str | None = None


class Usage(BaseModel):
    cost: float | None = None


class ImagesResponse(BaseModel):
    data: list[ImageItem]
    usage: Usage | None = None


@dataclass(frozen=True)
class Clients:
    api: httpx.AsyncClient  # carries the OpenRouter key
    download: httpx.AsyncClient  # no credentials: image URLs can point at any host


class Render(BaseModel):
    slug: str
    file: str
    cost_usd: float | None
    created: str


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip("'\"")
    return env


def load_manifest(path: Path) -> dict[str, Render]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text())
    return {slug: Render.model_validate(r) for slug, r in raw.items()}


def save_manifest(path: Path, renders: dict[str, Render]) -> None:
    ordered = {slug: renders[slug].model_dump() for slug in sorted(renders)}
    path.write_text(json.dumps(ordered, indent=2) + "\n")


def matches(concept: Concept, name: str) -> bool:
    return concept.slug == name or concept.slug.startswith(f"{name}-")


def select(concepts: list[Concept], names: list[str]) -> list[Concept]:
    if not names:
        return concepts
    if unknown := [n for n in names if not any(matches(c, n) for c in concepts)]:
        sys.exit(f"Unknown concept(s): {', '.join(unknown)}")
    return [c for c in concepts if any(matches(c, n) for n in names)]


async def fetch_image(clients: Clients, payload: dict[str, object]) -> tuple[bytes, float | None]:
    response = await clients.api.post(ENDPOINT, json=payload)
    if response.status_code != 200:
        raise RuntimeError(f"HTTP {response.status_code}: {response.text[:500]}")
    body = ImagesResponse.model_validate(response.json())
    if not body.data:
        raise RuntimeError(f"No image in response: {response.text[:500]}")
    item = body.data[0]
    if item.b64_json:
        image = base64.b64decode(item.b64_json)
    elif item.url:
        image = (await clients.download.get(item.url)).raise_for_status().content
    else:
        raise RuntimeError(f"Image without data or URL: {response.text[:500]}")
    return image, body.usage.cost if body.usage else None


def reference(ref: str) -> dict[str, object]:
    path = ROOT / "concepts" / ref
    if not path.exists():
        raise FileNotFoundError(f"Reference image not found: {path.relative_to(ROOT)}")
    mime = mimetypes.guess_type(path.name)[0]
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        raise ValueError(f"Reference must be PNG, JPEG, or WebP: {path.relative_to(ROOT)}")
    encoded = base64.b64encode(path.read_bytes()).decode()
    return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}}


async def render(clients: Clients, gate: asyncio.Semaphore, base: str, concept: Concept, out: Path) -> Render:
    payload: dict[str, object] = {
        "model": MODEL,
        "prompt": base + concept.prompt,
        "quality": QUALITY,
        "aspect_ratio": concept.aspect,
        "n": 1,
    }
    if concept.references:
        payload["input_references"] = [reference(ref) for ref in concept.references]
    async with gate:
        image, cost = await fetch_image(clients, payload)
    path = out / f"{concept.slug}.png"
    path.write_bytes(image)
    print(f"  {concept.slug}  ${cost if cost is not None else '?'}")
    return Render(
        slug=concept.slug,
        file=path.name,
        cost_usd=cost,
        created=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("round", help="folder under concepts/, e.g. round-2")
    parser.add_argument("concepts", nargs="*", help="number prefix (01) or full slug")
    parser.add_argument("--force", action="store_true", help="re-render existing files")
    args = parser.parse_args()

    env = load_env(ROOT / ".env")
    # Cost guard: Nathan wants mockups on the cheapest setting, so a stray .env edit can't upscale them.
    if env.get("OPENROUTER_IMAGE_MODEL") != MODEL or env.get("OPENROUTER_IMAGE_QUALITY") != QUALITY:
        sys.exit(f".env must pin OPENROUTER_IMAGE_MODEL={MODEL} and OPENROUTER_IMAGE_QUALITY={QUALITY}")

    out = ROOT / "concepts" / args.round
    prompts = out / "prompts.toml"
    if not prompts.exists():
        sys.exit(f"No prompts at {prompts.relative_to(ROOT)}")
    spec = Round.model_validate(tomllib.loads(prompts.read_text()))

    todo = [c for c in select(spec.concept, args.concepts) if args.force or not (out / f"{c.slug}.png").exists()]
    if not todo:
        print("Nothing to render.")
        return

    print(f"Rendering {len(todo)} concept(s) in {args.round} with {MODEL} at quality={QUALITY}")
    headers = {"Authorization": f"Bearer {env['OPENROUTER_API_KEY']}"}
    gate = asyncio.Semaphore(CONCURRENCY)
    async with (
        httpx.AsyncClient(headers=headers, timeout=300) as api,
        httpx.AsyncClient(timeout=300) as download,
    ):
        clients = Clients(api=api, download=download)
        results = await asyncio.gather(
            *(render(clients, gate, spec.base, c, out) for c in todo), return_exceptions=True
        )

    manifest_path = out / "manifest.json"
    manifest = load_manifest(manifest_path)
    failures = 0
    for concept, result in zip(todo, results):
        if isinstance(result, BaseException):
            failures += 1
            print(f"  FAILED {concept.slug}: {result}", file=sys.stderr)
            continue
        manifest[result.slug] = result
    save_manifest(manifest_path, manifest)

    spent = sum(r.cost_usd or 0 for r in results if isinstance(r, Render))
    total = sum(r.cost_usd or 0 for r in manifest.values())
    print(f"Done. Spent ${spent:.4f} this run; the images now in {args.round} cost ${total:.4f} (re-renders not counted).")
    if failures:
        sys.exit(f"{failures} concept(s) failed")


if __name__ == "__main__":
    asyncio.run(main())
