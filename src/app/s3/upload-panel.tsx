"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui";

type Item = { name: string; size: number; sent: number; status: "queued" | "uploading" | "done" | "error"; error?: string };

/** Streams files to /api/s3/upload (multipart on the server), with progress. */
export function UploadPanel({ bucket, prefix }: { bucket: string; prefix: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list);
    setFiles((f) => [...f, ...next]);
    setItems((i) => [...i, ...next.map((f) => ({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, size: f.size, sent: 0, status: "queued" as const }))]);
  }

  function put(file: File, key: string, idx: number) {
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/s3/upload?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`);
      xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => setItems((it) => it.map((x, i) => (i === idx ? { ...x, sent: e.loaded, status: "uploading" } : x)));
      xhr.onload = () => {
        setItems((it) => it.map((x, i) => (i === idx ? { ...x, sent: x.size, status: xhr.status < 300 ? "done" : "error", error: xhr.status < 300 ? undefined : xhr.responseText } : x)));
        resolve();
      };
      xhr.onerror = () => {
        setItems((it) => it.map((x, i) => (i === idx ? { ...x, status: "error", error: "Network error" } : x)));
        resolve();
      };
      xhr.send(file);
    });
  }

  async function start() {
    setBusy(true);
    for (let i = 0; i < files.length; i++) {
      if (items[i]?.status === "done") continue;
      await put(files[i], prefix + items[i].name, i);
    }
    setBusy(false);
    router.refresh();
  }

  const fmt = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Destination: <span className="font-mono">s3://{bucket}/{prefix}</span>. Large files are uploaded with multipart upload.</p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
        className="rounded-xl border-2 border-dashed border-line-strong p-6 text-center text-sm text-muted"
      >
        Drag and drop files here, or
        <label className="mx-1 cursor-pointer text-accent hover:underline">add files<input type="file" multiple hidden onChange={(e) => add(e.target.files)} /></label>
        or
        <label className="ml-1 cursor-pointer text-accent hover:underline">add folder<input type="file" multiple hidden {...({ webkitdirectory: "" } as object)} onChange={(e) => add(e.target.files)} /></label>
      </div>
      {items.length > 0 && (
        <ul className="max-h-60 space-y-2 overflow-auto">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <div className="flex justify-between gap-3"><span className="truncate font-mono text-xs">{it.name}</span><span className="text-xs text-muted">{fmt(it.size)} · {it.status}</span></div>
              <div className="mt-1 h-1.5 rounded bg-line"><div className={`h-1.5 rounded ${it.status === "error" ? "bg-danger" : "bg-accent"}`} style={{ width: `${it.size ? Math.round((it.sent / it.size) * 100) : 100}%` }} /></div>
              {it.error && <p className="text-xs text-danger">{it.error}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <button type="button" className={buttonClass("primary")} disabled={busy || !items.some((i) => i.status !== "done")} onClick={start}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}
