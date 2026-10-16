import { getLocale, getTranslations } from "next-intl/server";
import { signPlaybackToken } from "@/lib/video";
import { pickLocale } from "@/lib/i18n/localized";
import type { videoQuestionsRepository } from "@/lib/db/repositories/video-questions";
import { VideoEmbed, type VideoPosition } from "./video-embed";

type QuestionRows = Awaited<
  ReturnType<typeof videoQuestionsRepository.listForLessonWithAnswers>
>;

/**
 * Bunny Stream iframe with a signed, expiring playback URL (view-only, no
 * downloads). Speed control + subtitles are native to the Bunny player UI, so
 * they come for free inside the iframe. Falls back to a placeholder when the
 * lesson has no video yet. In-video questions are serialized here WITHOUT
 * their correct answers (revealed only by the answer action).
 *
 * `startAt` resumes where the student left off: Bunny's `t` embed parameter,
 * with Bunny's own per-browser position memory off so ours (saved per student,
 * on any device) is the only one.
 */
export async function VideoFrame({
  bunnyVideoId,
  title,
  videoQuestions = [],
  durationSeconds = null,
  position = null,
  startAt = 0,
}: {
  bunnyVideoId: string | null;
  title: string;
  videoQuestions?: QuestionRows;
  durationSeconds?: number | null;
  /** Save the playhead for this part (enrolled students only). */
  position?: VideoPosition | null;
  /** Saved playhead to resume from, in seconds (0 = the beginning). */
  startAt?: number;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("Player"),
    getLocale(),
  ]);

  if (!bunnyVideoId) {
    return (
      <div className="relative grid aspect-video w-full place-items-center overflow-hidden bg-[#0A1622]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 60% 40%,#1B3A57,#0A1622 70%)" }}
        />
        <p className="relative text-[.9rem] text-lp-on-navy">{t("noVideo")}</p>
      </div>
    );
  }

  const playback = signPlaybackToken(bunnyVideoId);
  // The token signs the embed path only, so extra parameters are safe to add.
  const src = new URL(playback.url);
  src.searchParams.set("rememberPosition", "false");
  if (startAt > 0) src.searchParams.set("t", String(startAt));

  return (
    <VideoEmbed
      key={src.href}
      src={src.href}
      position={position}
      startAt={startAt}
      title={title}
      initialDuration={durationSeconds ?? 0}
      questions={videoQuestions.map((q) => ({
        id: q.id,
        t: q.timestampSeconds,
        prompt: pickLocale(q.prompt, locale) ?? "",
        options: q.options.map((o) => pickLocale(o, locale) ?? ""),
        answered: q.answeredIndex != null,
        correct: q.answeredIndex != null ? Boolean(q.answeredCorrect) : null,
      }))}
    />
  );
}
