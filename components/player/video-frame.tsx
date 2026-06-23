import { getTranslations } from "next-intl/server";
import { signPlaybackToken } from "@/lib/video";

/**
 * Bunny Stream iframe with a signed, expiring playback URL (view-only, no
 * downloads). Speed control + subtitles are native to the Bunny player UI, so
 * they come for free inside the iframe. Falls back to a placeholder when the
 * lesson has no video yet.
 */
export async function VideoFrame({
  bunnyVideoId,
  title,
}: {
  bunnyVideoId: string | null;
  title: string;
}) {
  const t = await getTranslations("Player");

  if (!bunnyVideoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-line bg-navy-900 text-navy-100">
        {t("noVideo")}
      </div>
    );
  }

  const playback = signPlaybackToken(bunnyVideoId);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        src={playback.url}
        title={title}
        loading="lazy"
        allow="accelerated-2d-canvas; fullscreen; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}
