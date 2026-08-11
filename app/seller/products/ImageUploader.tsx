"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sellerApi } from "@/lib/seller";

/**
 * Photo picker for a seller's listing.
 *
 * Sellers here photograph stock on a phone; asking them for image *URLs* meant
 * uploading somewhere else first, which in practice meant listings went up with
 * no picture at all. So each file is sent to /api/seller/media the moment it is
 * chosen, and the media-library URL that comes back is what the product form
 * submits.
 *
 * Uploading per file rather than on submit is what makes a dropped connection
 * survivable: one photo fails, the seller retries that one photo, and the form
 * they filled in is still sitting there.
 */

const MAX_PHOTOS = 8;
/** Matches the ceiling in the media route and the WordPress plugin. */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Photo = {
  /** Stable key across the upload's lifetime — the URL is not known up front. */
  key: string;
  /** Media-library URL, once the upload has landed. */
  url: string | null;
  /** Local object URL shown while the file is in flight. */
  preview: string | null;
  status: "uploading" | "done" | "error";
  error?: string;
  /** Kept so a failed upload can be retried without re-picking the file. */
  file?: File;
};

type Props = {
  /** Photos the listing already has. Read once, on mount. */
  initialUrls?: string[];
  /** Fires with the URLs of the photos that have finished uploading, in order. */
  onChange: (urls: string[]) => void;
  /** Fires while any upload is in flight, so the form can hold its Save button. */
  onBusyChange?: (busy: boolean) => void;
  /** "square" matches the listing form, "soft" the rounded slide-over editor. */
  shape?: "square" | "soft";
};

let counter = 0;
const nextKey = () => `photo-${++counter}`;

export default function ImageUploader({
  initialUrls = [],
  onChange,
  onBusyChange,
  shape = "square",
}: Props) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    initialUrls.filter(Boolean).map((url) => ({
      key: nextKey(),
      url,
      preview: null,
      status: "done" as const,
    }))
  );
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const radius = shape === "soft" ? "rounded-xl" : "";
  const inner = shape === "soft" ? "rounded-lg" : "";

  // The parent only ever needs the finished URLs, so the callbacks fire off the
  // derived values rather than the raw list. Latest-ref for the callbacks keeps
  // a parent that passes an inline arrow from re-triggering this every render.
  const onChangeRef = useRef(onChange);
  const onBusyRef = useRef(onBusyChange);
  useEffect(() => {
    onChangeRef.current = onChange;
    onBusyRef.current = onBusyChange;
  });

  const urls = photos.filter((photo) => photo.status === "done" && photo.url).map((photo) => photo.url!);
  const urlKey = urls.join("\n");
  const busy = photos.some((photo) => photo.status === "uploading");

  useEffect(() => {
    onChangeRef.current(urlKey === "" ? [] : urlKey.split("\n"));
  }, [urlKey]);

  useEffect(() => {
    onBusyRef.current?.(busy);
  }, [busy]);

  // Object URLs pin the file's bytes in memory until they are handed back. They
  // are revoked as each upload lands or its tile is removed; this catches the
  // ones still open if the seller navigates away mid-upload, and reads from a
  // ref because an unmount cleanup only ever sees its first render's state.
  const livePreviews = useRef(new Set<string>());
  useEffect(() => {
    const open = livePreviews.current;
    return () => {
      open.forEach((url) => URL.revokeObjectURL(url));
      open.clear();
    };
  }, []);

  const releasePreview = useCallback((url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    livePreviews.current.delete(url);
  }, []);

  const upload = useCallback(
    async (key: string, file: File) => {
    try {
      const { url } = await sellerApi.uploadImage(file);
      setPhotos((current) =>
        current.map((photo) => {
          if (photo.key !== key) return photo;
          releasePreview(photo.preview);
          return { ...photo, url, preview: null, status: "done" as const, file: undefined };
        })
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Upload failed.";
      setPhotos((current) =>
        current.map((photo) =>
          photo.key === key ? { ...photo, status: "error" as const, error: message } : photo
        )
      );
      // Also printed in full under the grid. A red "Failed" on a thumbnail says
      // that something went wrong but never what, and the reason here is often
      // something the seller can act on — a file too large, a session that
      // expired, a backend that has not been updated yet.
      setNotice(message);
    }
    },
    [releasePreview]
  );

  const accept = useCallback(
    (files: FileList | File[]) => {
      setNotice(null);
      const chosen = Array.from(files);
      if (chosen.length === 0) return;

      const queued: Photo[] = [];
      let room = MAX_PHOTOS - photos.length;

      for (const file of chosen) {
        if (room <= 0) {
          setNotice(`A listing can hold ${MAX_PHOTOS} photos.`);
          break;
        }
        if (!ACCEPTED.includes(file.type)) {
          setNotice(`${file.name} is not a JPEG, PNG, WebP or GIF.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          setNotice(`${file.name} is larger than 8 MB.`);
          continue;
        }

        const preview = URL.createObjectURL(file);
        livePreviews.current.add(preview);
        queued.push({ key: nextKey(), url: null, preview, status: "uploading", file });
        room -= 1;
      }

      if (queued.length === 0) return;

      setPhotos((current) => [...current, ...queued]);
      queued.forEach((photo) => upload(photo.key, photo.file!));
    },
    [photos.length, upload]
  );

  const remove = (key: string) =>
    setPhotos((current) =>
      current.filter((photo) => {
        if (photo.key !== key) return true;
        releasePreview(photo.preview);
        return false;
      })
    );

  const move = (index: number, direction: -1 | 1) =>
    setPhotos((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const retry = (photo: Photo) => {
    if (!photo.file) return;
    setPhotos((current) =>
      current.map((entry) =>
        entry.key === photo.key ? { ...entry, status: "uploading", error: undefined } : entry
      )
    );
    upload(photo.key, photo.file);
  };

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div>
      {/* Drop zone. Also a button, so keyboard and screen-reader users get the
          same file picker rather than a decorative rectangle. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={full}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!full) accept(event.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 border-2 border-dashed px-4 py-7 text-center transition-colors ${radius} ${
          dragging
            ? "border-shop-primary bg-shop-primary-soft"
            : "border-bfl-line bg-white hover:border-shop-primary"
        } ${full ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span className="text-[15px] font-semibold text-black">
          {full ? `${MAX_PHOTOS} photos added` : "Upload photos"}
        </span>
        <span className="text-[13px] text-bfl-grey">
          {full
            ? "Remove one to add another."
            : "Tap to choose from your phone or computer, or drag files here."}
        </span>
        <span className="text-[12px] text-bfl-grey">
          JPEG, PNG, WebP or GIF · up to 8 MB each · {MAX_PHOTOS} maximum
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) accept(event.target.files);
          // Reset, or picking the same file twice in a row fires nothing.
          event.target.value = "";
        }}
      />

      {notice && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-pop-red">
          {notice}
        </p>
      )}

      {photos.length > 0 && (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <li
                key={photo.key}
                className={`relative aspect-square overflow-hidden border border-bfl-line bg-bfl-surface ${inner}`}
              >
                {(photo.preview || photo.url) && (
                  // A plain img: these come straight from the WordPress media
                  // library, whose host is not in next.config's remotePatterns,
                  // and a 96px thumbnail is not worth an optimiser round trip.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.preview ?? photo.url ?? ""}
                    alt=""
                    className={`h-full w-full object-cover ${
                      photo.status === "done" ? "" : "opacity-50"
                    }`}
                  />
                )}

                {photo.status === "uploading" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-[12px] font-semibold text-black">
                    Uploading…
                  </span>
                )}

                {photo.status === "error" && (
                  <button
                    type="button"
                    onClick={() => retry(photo)}
                    title={photo.error}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-white/85 px-1 text-[12px] font-semibold text-pop-red"
                  >
                    <span>Failed</span>
                    <span className="underline">Retry</span>
                  </button>
                )}

                {index === 0 && photo.status === "done" && (
                  <span className="absolute left-0 top-0 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Main
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => remove(photo.key)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[15px] leading-none text-white hover:bg-black"
                >
                  ×
                </button>

                {/* Order decides which photo shoppers see first, so it has to be
                    changeable without deleting and re-uploading. */}
                {photos.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move photo earlier"
                      className="px-2 py-0.5 text-[13px] text-white disabled:opacity-30"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === photos.length - 1}
                      aria-label="Move photo later"
                      className="px-2 py-0.5 text-[13px] text-white disabled:opacity-30"
                    >
                      ›
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-2 text-[12px] text-bfl-grey">
            The first photo is the one shoppers see in search and on the shop front.
          </p>
        </>
      )}
    </div>
  );
}
