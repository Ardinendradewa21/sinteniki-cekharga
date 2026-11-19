"use client"

import { createContext, useContext, useId, useState, type ReactNode } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { LinkSquare01Icon, PlayIcon } from "@hugeicons/core-free-icons"

import { formatClock } from "@/lib/reviews/review-format"
import { parseYoutubeVideoId, youtubeWatchUrl } from "@/lib/reviews/youtube-match"
import { cn } from "@/lib/utils"

/**
 * Video ulasan di dalam kartu (RV-01, permintaan PO 19 Nov 2026).
 *
 * Pola "facade": sebelum diklik hanya thumbnail + tombol putar. Pemutar
 * YouTube (berat, dan menanam cookie) baru dimuat saat pengunjung menekan
 * putar, dari domain `youtube-nocookie.com`. Halaman tetap ringan (antislop
 * R-40) dan tidak ada skrip pihak ketiga yang jalan tanpa tindakan pengguna
 * (semangat ADS-CONTEXT §2.5 untuk skrip pihak ketiga).
 *
 * `ReviewVideoProvider` membungkus satu kartu supaya tombol menit di poin
 * ulasan (`TimestampButton`) bisa memutar video kartu yang sama mulai dari
 * menit itu.
 */

type VideoState = {
  videoId: string | null
  watchUrl: string
  start: number | null
  playing: boolean
  play: (seconds: number | null, options?: { reveal?: boolean }) => void
  /** id kotak pemutar, untuk menggulirnya ke layar dari tombol menit. */
  frameId: string
}

const VideoContext = createContext<VideoState | null>(null)

export function ReviewVideoProvider({
  videoUrl,
  startSeconds,
  children,
}: {
  videoUrl: string
  startSeconds: number | null
  children: ReactNode
}) {
  const videoId = parseYoutubeVideoId(videoUrl)
  const [state, setState] = useState<{ playing: boolean; start: number | null }>({ playing: false, start: startSeconds })
  const frameId = useId()
  const value: VideoState = {
    videoId,
    watchUrl: videoUrl,
    start: state.start,
    playing: state.playing,
    frameId,
    play: (seconds, options) => {
      setState({ playing: true, start: seconds ?? startSeconds })
      // Tombol menit di poin: bawa pemutar ke layar (di ponsel bisa di atas lipatan).
      if (options?.reveal) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        document.getElementById(frameId)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
      }
    },
  }
  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>
}

export function ReviewVideo({ channelName, className }: { channelName: string; className?: string }) {
  const video = useContext(VideoContext)
  if (!video?.videoId) return null
  const { videoId, start, playing } = video
  const openUrl = youtubeWatchUrl(videoId, start)

  return (
    <div className={cn("mt-4", className)}>
      {/* Kotak 16:9 dipesan sejak awal: tidak ada pergeseran tata letak saat
          thumbnail berganti pemutar (CLS 0). */}
      <div id={video.frameId} className="relative aspect-video w-full scroll-mt-24 overflow-hidden rounded-lg bg-foreground/10">
        {playing ? (
          <iframe
            // key: menit baru = muat ulang pemutar dari menit itu.
            key={start ?? 0}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1${start ? `&start=${start}` : ""}`}
            title={`Video ulasan ${channelName}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => video.play(start)}
            className="group absolute inset-0 size-full cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Image
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
            {/* Tombol putar di atas pelapis gelap: ikon putih tetap kontras di
                thumbnail apa pun. Teks tombol ada di sr-only. */}
            <span aria-hidden className="absolute inset-0 bg-black/25 transition-colors duration-150 group-hover:bg-black/15" />
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 flex size-14 -translate-1/2 items-center justify-center rounded-pill bg-black/70 text-white transition-transform duration-150 group-hover:scale-105"
            >
              <HugeiconsIcon icon={PlayIcon} size={26} strokeWidth={2} />
            </span>
            {start ? (
              <span aria-hidden className="absolute right-2 bottom-2 rounded-md bg-black/75 px-2 py-0.5 text-xs font-semibold text-white">
                mulai {formatClock(start)}
              </span>
            ) : null}
            <span className="sr-only">
              Putar video ulasan {channelName} di halaman ini{start ? `, mulai menit ${formatClock(start)}` : ""}
            </span>
          </button>
        )}
      </div>

      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-text underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
      >
        Buka di YouTube
        <HugeiconsIcon icon={LinkSquare01Icon} size={15} strokeWidth={2} aria-hidden />
        <span className="sr-only">(membuka aplikasi atau tab baru)</span>
      </a>
    </div>
  )
}

/** Tombol menit di poin ulasan: memutar video kartu ini mulai dari menit itu (RV-02). */
export function TimestampButton({ seconds, label }: { seconds: number; label: string }) {
  const video = useContext(VideoContext)
  if (!video?.videoId) return null
  return (
    // Area sentuh 44px (R-03); kapsul yang terlihat tetap kecil di dalamnya.
    // Tanpa margin negatif: area sentuh baris berdekatan tidak boleh bertumpuk.
    <button
      type="button"
      onClick={() => video.play(seconds, { reveal: true })}
      className="group inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-pill focus-visible:outline-none"
    >
      <span className="inline-flex items-center gap-1 rounded-pill border border-border bg-card px-2 py-1 text-xs font-semibold text-brand-text tabular transition-colors duration-150 group-hover:bg-muted group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <HugeiconsIcon icon={PlayIcon} size={12} strokeWidth={2.2} aria-hidden />
        {formatClock(seconds)}
      </span>
      <span className="sr-only">: putar bagian video tentang {label}</span>
    </button>
  )
}
