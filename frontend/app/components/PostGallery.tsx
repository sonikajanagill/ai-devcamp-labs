"use client";

// Approved posts + generated images, pulled from the same AG-UI message
// stream ActivityFeed reads. Images are local files written by
// tools.py:generate_image — backend/main.py mounts them at /outputs so the
// browser can actually render them.
//
// The live message stream only covers THIS browser session — reload the
// page or restart the backend and it's gone. /api/posts (backend/social_poster/db.py)
// is the durable record of what actually got published, so it's merged in
// underneath the live list to fill in anything from before this page load.

import { useEffect, useState } from "react";
import { useCopilotChatInternal } from "@copilotkit/react-core";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://localhost:8000";

type PostEntry = {
  id: string;
  text: string;
  platform: string;
  url?: string;
  failed: boolean;
  imageUrl?: string;
};

type ImageEntry = {
  id: string;
  url: string;
  prompt: string;
  imagePath: string;
  hostedUrl?: string;
  hostedDryRun?: boolean;
};

function tryParseJSON(raw: unknown): any {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// MCP tool results are sometimes wrapped as {content: [{type:"text", text: "<json>"}]}
// (Buffer's remote server) vs. a plain dict (LinkedIn's local FastMCP server).
function unwrapMcpContent(result: any): any {
  if (result && Array.isArray(result.content) && typeof result.content[0]?.text === "string") {
    return tryParseJSON(result.content[0].text);
  }
  return result;
}

// Buffer's create_post takes a channelId; LinkedIn's MCP does not.
function inferPlatform(args: any): string {
  return args?.channelId ? "Buffer" : "LinkedIn";
}

// Recursively collect every string leaf from a tool call's args — LinkedIn's
// create_post carries the image under a known `image_path` key, but Buffer's
// schema is hosted/dynamic (could nest it under `media`, `attachments`, etc.),
// so this searches every value rather than guessing one key name.
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, acc));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectStrings(v, acc));
  }
  return acc;
}

// Matches a create_post call back to the image it attached, by looking for
// that image's local path or hosted URL anywhere in the call's args.
function findImageForPost(args: any, images: ImageEntry[]): ImageEntry | undefined {
  const candidates = collectStrings(args);
  return images.find(
    (img) =>
      candidates.includes(img.imagePath) || (img.hostedUrl && candidates.includes(img.hostedUrl)),
  );
}

type DbPost = {
  id: number;
  platform: string;
  text: string;
  image_path: string | null;
  image_url: string | null;
  post_url: string | null;
};

function dbPostToEntry(row: DbPost): PostEntry {
  const filename = row.image_path ? row.image_path.split("/").pop() : undefined;
  return {
    id: `db-${row.id}`,
    text: row.text,
    platform: row.platform,
    url: row.post_url ?? undefined,
    failed: false,
    imageUrl: row.image_url ?? (filename ? `${BACKEND_ORIGIN}/outputs/${filename}` : undefined),
  };
}

function collectGallery(messages: any[]): { images: ImageEntry[]; posts: PostEntry[] } {
  const images: ImageEntry[] = [];
  const posts: PostEntry[] = [];
  const pending = new Map<string, { name: string; args: any }>();

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      for (const call of msg.toolCalls) {
        // LinkedIn's tools arrive prefixed (linkedin_create_post) so they
        // don't collide with Buffer's create_post; treat them the same here.
        const name = call.function?.name?.replace(/^linkedin_/, "");
        if (name === "generate_image" || name === "create_post" || name === "upload_image") {
          pending.set(call.id, { name, args: tryParseJSON(call.function?.arguments) });
        }
      }
    } else if (msg.role === "tool" && msg.toolCallId) {
      const call = pending.get(msg.toolCallId);
      if (!call) continue;
      const result = unwrapMcpContent(tryParseJSON(msg.content));
      const failed = Boolean(msg.error) || result?.isError === true || result?.status === "error";

      if (call.name === "generate_image") {
        if (!failed && result?.image_path) {
          const filename = String(result.image_path).split("/").pop();
          images.push({
            id: msg.toolCallId,
            url: `${BACKEND_ORIGIN}/outputs/${filename}`,
            prompt: call.args?.prompt ?? "",
            imagePath: result.image_path,
          });
        }
      } else if (call.name === "upload_image") {
        if (!failed && result?.url && call.args?.image_path) {
          const match = images.find((img) => img.imagePath === call.args.image_path);
          if (match) {
            match.hostedUrl = result.url;
            match.hostedDryRun = Boolean(result.dry_run);
          }
        }
      } else if (call.name === "create_post" && !failed) {
        posts.push({
          id: msg.toolCallId,
          text: call.args?.text ?? "",
          platform: inferPlatform(call.args),
          url: result?.post_url ?? result?.url,
          failed: false,
          imageUrl: findImageForPost(call.args, images)?.url,
        });
      }
    }
  }
  return { images, posts };
}

// Below this length a tile's text always fits within the 4-line clamp, so
// no "Read more" toggle is offered — avoids a button that would expand to
// reveal nothing new.
const TILE_TEXT_PREVIEW_LIMIT = 180;

export function PostGallery() {
  const { messages } = useCopilotChatInternal();
  const { images, posts: livePosts } = collectGallery((messages as any[]) ?? []);

  const [dbPosts, setDbPosts] = useState<PostEntry[]>([]);
  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/api/posts`)
      .then((r) => r.json())
      .then((data) => setDbPosts((data.posts ?? []).map(dbPostToEntry)))
      .catch(() => {
        // backend/db unreachable — the live-session list below still works
      });
  }, []);

  const liveUrls = new Set(livePosts.map((p) => p.url).filter(Boolean));
  const posts = [...livePosts, ...dbPosts.filter((p) => !p.url || !liveUrls.has(p.url))];

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (images.length === 0 && posts.length === 0) {
    return null; // nothing approved/generated yet — keep the dashboard uncluttered
  }

  return (
    <section className="card">
      <h2>Approved Posts &amp; Images</h2>
      {posts.length > 0 && (
        <ul className="gallery-posts">
          {posts.map((p) => {
            const isExpanded = expanded.has(p.id);
            const isLong = p.text.length > TILE_TEXT_PREVIEW_LIMIT;
            return (
              <li key={p.id} className="gallery-tile">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="gallery-tile-image" src={p.imageUrl} alt="" />
                )}
                <div className="gallery-tile-body">
                  <span className="gallery-platform">{p.platform}</span>
                  <p className={isExpanded ? undefined : "gallery-tile-text"}>{p.text}</p>
                  {isLong && (
                    <button
                      type="button"
                      className="gallery-readmore"
                      onClick={() => toggleExpanded(p.id)}
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      view ↗
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {images.length > 0 && (
        <div className="gallery-images">
          {images.map((img) => (
            <div key={img.id} className="gallery-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.prompt} title={img.prompt} />
              {img.hostedUrl &&
                (img.hostedDryRun ? (
                  <span className="gallery-hosted gallery-hosted-dryrun" title={img.hostedUrl}>
                    DRY_RUN — not actually uploaded
                  </span>
                ) : (
                  <a
                    className="gallery-hosted"
                    href={img.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hosted on GCS ↗
                  </a>
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
