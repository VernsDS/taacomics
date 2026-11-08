"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

const REPEAT_STORAGE_KEY = "taacomics_music_repeat";
const BTN_SIZE = 54;
const EDGE_MARGIN = 8;
const BOTTOM_RESERVE = 76;

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function clampPosition(x, y) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - BTN_SIZE - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - BTN_SIZE - BOTTOM_RESERVE);
  return {
    x: Math.max(EDGE_MARGIN, Math.min(maxX, x)),
    y: Math.max(EDGE_MARGIN, Math.min(maxY, y)),
  };
}

export default function MusicPlayer() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [pickedTrack, setPickedTrack] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searching, setSearching] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [pos, setPos] = useState(null);
  const [repeat, setRepeat] = useState(false);

  const audioRef = useRef(null);
  const btnRef = useRef(null);
  const repeatRef = useRef(false);
  const openAtRef = useRef(0);
  const dragData = useRef({
    active: false,
    pointerId: null,
    moved: false,
    sx: 0,
    sy: 0,
    bx: 0,
    by: 0,
  });

  const hide =
    pathname === "/about" ||
    pathname?.startsWith("/search") ||
    pathname?.startsWith("/admin");

  /* Load persisted repeat state from localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REPEAT_STORAGE_KEY);
      const active = saved === "true" || saved === "1";
      setRepeat(active);
      repeatRef.current = active;
    } catch {
      setRepeat(false);
      repeatRef.current = false;
    }
  }, []);

  /* Sync repeatRef & native audio.loop fallback */
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  /* Clamp floating button position on viewport resize & orientation change */
  useEffect(() => {
    function handleViewportChange() {
      setPos((prev) => {
        if (!prev) return null;
        return clampPosition(prev.x, prev.y);
      });
    }
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, []);

  function toggleRepeat() {
    setRepeat((prev) => {
      const next = !prev;
      repeatRef.current = next;
      try {
        localStorage.setItem(REPEAT_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }

  /* Search tracks from YouTube endpoint */
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setSearching(true);
    setAudioError(null);
    try {
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.results || [];
      setTracks(list);
      if (list.length === 0) {
        setAudioError("Lagu tidak ditemukan. Coba kata lain.");
      } else {
        openAtRef.current = performance.now();
        setIsOpen(true);
      }
    } catch (e) {
      console.error("music search err", e);
      setAudioError("Gagal mencari lagu. Coba lagi.");
    } finally {
      setSearching(false);
    }
  }, []);

  /* Resolve playable audio stream via /api/music */
  const resolveAndPlay = useCallback(async (track) => {
    if (!track) return;
    setPickedTrack(track);
    setResolving(true);
    setAudioError(null);
    try {
      const q = [track.title, track.author].filter(Boolean).join(" ");
      const res = await fetch(`/api/music?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const resolved = data.result || data.results?.[0];
      if (!resolved?.streamUrl) throw new Error("no mp3");
      setCurrentTrack({ ...resolved, searchTitle: track.title, searchAuthor: track.author });
    } catch (e) {
      console.error("music resolve err", e);
      setCurrentTrack(null);
      setAudioError("Gagal memuat audio lagu ini. Coba lagu lain.");
    } finally {
      setResolving(false);
    }
  }, []);

  /* Auto-play when a track finishes resolving */
  useEffect(() => {
    const audio = audioRef.current;
    if (!currentTrack || !audio) return;
    const audioUrl = currentTrack.streamUrl || currentTrack.previewUrl || currentTrack.mp3;
    if (!audioUrl) return;
    setAudioError(null);
    audio.src = audioUrl;
    audio.load();
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack]);

  /* Audio event listeners (including single-track repeat handling) */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };

    const onLoaded = () => setDuration(audio.duration || 0);

    const onEnded = () => {
      if (repeatRef.current) {
        audio.currentTime = 0;
        setProgress(0);
        setCurrentTime(0);
        const replayPromise = audio.play();
        if (replayPromise !== undefined) {
          replayPromise
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
        return;
      }

      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      const idx = tracks.findIndex((t) => pickedTrack && t.id === pickedTrack.id);
      if (idx !== -1 && tracks[idx + 1]) {
        resolveAndPlay(tracks[idx + 1]);
      }
    };

    const onError = () => {
      if (
        currentTrack?.mp3 &&
        !audio.src.endsWith(encodeURIComponent(currentTrack.mp3)) &&
        audio.src !== currentTrack.mp3
      ) {
        console.warn("Stream proxy failed, trying direct mp3...");
        audio.src = currentTrack.mp3;
        audio.load();
      } else {
        setAudioError("Audio tidak dapat diputar. Coba lagu lain.");
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [currentTrack, tracks, pickedTrack, resolveAndPlay]);

  if (hide) return null;

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    const audioUrl = currentTrack?.streamUrl || currentTrack?.previewUrl || currentTrack?.mp3;
    if (!audioUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Play failed:", err);
            setAudioError("Ketuk play untuk memutar lagu.");
          });
      }
    }
  }

  function playNext() {
    const idx = tracks.findIndex((t) => pickedTrack && t.id === pickedTrack.id);
    if (idx !== -1 && tracks[idx + 1]) resolveAndPlay(tracks[idx + 1]);
  }

  function playPrev() {
    const idx = tracks.findIndex((t) => pickedTrack && t.id === pickedTrack.id);
    if (idx > 0) resolveAndPlay(tracks[idx - 1]);
  }

  /* Unified Pointer Events with setPointerCapture and ghost-click protection */
  function handlePointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = btnRef.current?.getBoundingClientRect();
    const startX = pos?.x ?? window.innerWidth - (rect?.width || BTN_SIZE) - 16;
    const startY = pos?.y ?? window.innerHeight - (rect?.height || BTN_SIZE) - BOTTOM_RESERVE;

    dragData.current = {
      active: true,
      pointerId: e.pointerId,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      bx: startX,
      by: startY,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function handlePointerMove(e) {
    if (!dragData.current.active || dragData.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragData.current.sx;
    const dy = e.clientY - dragData.current.sy;
    if (Math.hypot(dx, dy) > 8) {
      dragData.current.moved = true;
      setPos(clampPosition(dragData.current.bx + dx, dragData.current.by + dy));
    }
  }

  function handlePointerUp(e) {
    if (!dragData.current.active || dragData.current.pointerId !== e.pointerId) return;
    const wasMoved = dragData.current.moved;
    dragData.current.active = false;
    dragData.current.pointerId = null;
    dragData.current.moved = false;

    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (!wasMoved) {
      e.preventDefault();
      e.stopPropagation();
      openAtRef.current = performance.now();
      setIsOpen(true);
    }
  }

  function handlePointerCancel(e) {
    dragData.current.active = false;
    dragData.current.pointerId = null;
    dragData.current.moved = false;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
  }

  function handleBackdropPointerUp(e) {
    if (e.target !== e.currentTarget) return;
    if (performance.now() - openAtRef.current < 400) return;
    setIsOpen(false);
  }

  const R = 23;
  const C = 2 * Math.PI * R;
  const dashOff = C * (1 - progress);
  const btnStyle = pos
    ? {
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        bottom: "auto",
        right: "auto",
        zIndex: 290,
        touchAction: "none",
      }
    : {
        position: "fixed",
        right: "16px",
        bottom: `${BOTTOM_RESERVE}px`,
        zIndex: 290,
        touchAction: "none",
      };

  const displayTrack = pickedTrack || currentTrack;

  return (
    <>
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />

      {/* Floating Draggable Button */}
      <div
        ref={btnRef}
        style={btnStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <button
          type="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openAtRef.current = performance.now();
              setIsOpen(true);
            }
          }}
          className="relative flex items-center justify-center rounded-full select-none"
          style={{
            width: BTN_SIZE,
            height: BTN_SIZE,
            background: "rgba(8,10,15,0.92)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2)",
            touchAction: "none",
          }}
          aria-label="Buka Pemutar Musik"
          aria-expanded={isOpen}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={BTN_SIZE}
            height={BTN_SIZE}
            viewBox="0 0 54 54"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle cx="27" cy="27" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
            <circle
              cx="27"
              cy="27"
              r={R}
              fill="none"
              stroke={isPlaying ? "#f59e0b" : "rgba(245,158,11,0.4)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={dashOff}
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          {displayTrack?.thumbnail ? (
            <Image
              src={displayTrack.thumbnail}
              alt=""
              width={32}
              height={32}
              unoptimized
              className="w-8 h-8 rounded-full object-cover pointer-events-none"
            />
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
          {isPlaying && (
            <span
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center pointer-events-none"
              style={{ background: "#f59e0b" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </span>
          )}
        </button>
      </div>

      {/* Player Modal Panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onPointerUp={handleBackdropPointerUp}
        >
          <div
            className="w-full max-w-sm mx-4 mb-20 rounded-3xl overflow-hidden"
            style={{
              background: "#0d0f17",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Playback Section */}
            <div className="px-5 pt-3 pb-5 flex flex-col items-center">
              <Image
                src={displayTrack?.thumbnail || "/favicon.png"}
                alt={displayTrack?.title || "Music Cover"}
                width={112}
                height={112}
                unoptimized
                className={`w-28 h-28 rounded-2xl object-cover shadow-2xl mb-4 ${
                  resolving ? "opacity-40 animate-pulse" : ""
                }`}
                style={{ border: "1px solid rgba(245,158,11,0.2)" }}
              />
              <p className="text-sm font-bold text-white text-center line-clamp-1 w-full mb-0.5">
                {displayTrack?.searchTitle || displayTrack?.title || "Cari lagu dulu"}
              </p>
              <p className="text-xs text-gray-400 mb-4 line-clamp-1">
                {displayTrack?.searchAuthor || displayTrack?.author || "Hasil pencarian tampil di bawah"}
              </p>

              {resolving && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  <p className="text-[11px] text-amber-400">Menyiapkan audio...</p>
                </div>
              )}
              {!resolving && audioError && (
                <p className="text-[11px] text-amber-400 mb-2 text-center px-4">{audioError}</p>
              )}

              <div className="w-full mb-1">
                <div
                  className="w-full h-1 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress * 100}%`,
                      background: "linear-gradient(to right,#f59e0b,#ef4444)",
                      transition: "width 0.25s linear",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: "#6b7280" }}>
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-[10px]" style={{ color: "#6b7280" }}>
                    {formatTime(duration || currentTrack?.duration || 0)}
                  </span>
                </div>
              </div>

              {/* Controls: Prev, Play/Pause, Next, Repeat Toggle */}
              <div className="flex items-center gap-5 mt-2">
                <button
                  type="button"
                  onClick={playPrev}
                  disabled={!pickedTrack || tracks.indexOf(pickedTrack) <= 0}
                  className="p-2 rounded-full transition-transform active:scale-95 disabled:opacity-30"
                  aria-label="Lagu sebelumnya"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#e5e7eb">
                    <polygon points="19,20 9,12 19,4" />
                    <rect x="5" y="4" width="2" height="16" rx="1" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!currentTrack || resolving}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                    boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
                  }}
                  aria-label={isPlaying ? "Jeda lagu" : "Putar lagu"}
                >
                  {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  disabled={!pickedTrack || tracks.indexOf(pickedTrack) >= tracks.length - 1}
                  className="p-2 rounded-full transition-transform active:scale-95 disabled:opacity-30"
                  aria-label="Lagu berikutnya"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#e5e7eb">
                    <polygon points="5,4 15,12 5,20" />
                    <rect x="17" y="4" width="2" height="16" rx="1" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={toggleRepeat}
                  aria-pressed={repeat}
                  aria-label={repeat ? "Matikan ulangi lagu" : "Aktifkan ulangi lagu"}
                  title={repeat ? "Repeat aktif (ulangi lagu ini)" : "Aktifkan repeat lagu"}
                  className="relative p-2 rounded-xl transition-all active:scale-95"
                  style={{
                    background: repeat ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.05)",
                    border: repeat
                      ? "1px solid rgba(245,158,11,0.45)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: repeat ? "#f59e0b" : "#9ca3af",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m17 2 4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="m7 22-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                  {repeat && (
                    <span
                      className="absolute -top-1 -right-1 text-[9px] font-extrabold px-1 rounded-full"
                      style={{ background: "#f59e0b", color: "#080a0f" }}
                    >
                      1
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="px-4 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = searchInput.trim();
                  if (q) doSearch(q);
                }}
                className="flex gap-2 mt-3"
              >
                <div className="relative flex-1">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Cari lagu..."
                    className="w-full text-sm pl-8 pr-3 py-2 rounded-xl outline-none text-gray-300 placeholder-gray-600"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchInput.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-white transition-opacity disabled:opacity-50 flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
                >
                  {searching ? "..." : "Cari"}
                </button>
              </form>
            </div>

            {/* Search Results */}
            {tracks.length > 0 && (
              <div className="px-4 pb-3 space-y-0.5 max-h-56 overflow-y-auto hide-scrollbar">
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4b5563" }}>
                  Hasil ({tracks.length})
                </p>
                {tracks.map((t) => {
                  const active = pickedTrack && pickedTrack.id === t.id;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => resolveAndPlay(t)}
                      disabled={resolving}
                      className="w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left disabled:opacity-60"
                      style={{
                        background: active ? "rgba(245,158,11,0.1)" : "transparent",
                        border: `1px solid ${active ? "rgba(245,158,11,0.2)" : "transparent"}`,
                      }}
                    >
                      <Image
                        src={t.thumbnail || "/favicon.png"}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white line-clamp-1">{t.title}</p>
                        <p className="text-[10px]" style={{ color: "#6b7280" }}>
                          {t.author}
                          {t.duration_timestamp ? ` · ${t.duration_timestamp}` : ""}
                          {t.views ? ` · ${t.views}` : ""}
                        </p>
                      </div>
                      {active && resolving ? (
                        <span className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin flex-shrink-0" />
                      ) : active && isPlaying ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="#f59e0b"
                          className="flex-shrink-0 animate-pulse"
                        >
                          <rect x="3" y="9" width="3" height="12" rx="1" />
                          <rect x="9" y="5" width="3" height="16" rx="1" />
                          <rect x="15" y="7" width="3" height="14" rx="1" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280" className="flex-shrink-0">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-3 text-xs text-center transition-colors hover:text-white"
              style={{ color: "#4b5563", borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
