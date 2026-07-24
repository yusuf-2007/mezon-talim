"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createVideoQuestionAction,
  type VideoQuestionFormState,
} from "@/lib/content/video-question-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./field";
import { ConfirmSubmit } from "./confirm-submit";
import { FormError } from "@/components/auth/form-bits";

export type StudioVideoQuestion = {
  id: string;
  time: string; // formatted mm:ss / h:mm:ss
  prompt: string;
  options: string[];
  correctIndex: number;
};

/** "111130" → "11:11:30" — digits grouped in twos from the right. */
function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return groups.join(":");
}

const initial: VideoQuestionFormState = {};

/**
 * Studio editor for a lesson's in-video popup questions: existing list with
 * delete, plus an add form (timestamp + bilingual prompt + 2–4 options with
 * one correct answer).
 */
export function VideoQuestionsEditor({
  lessonId,
  questions,
  deleteAction,
}: {
  lessonId: string;
  questions: StudioVideoQuestion[];
  deleteAction: (questionId: string) => Promise<void>;
}) {
  const t = useTranslations("Studio");
  const formRef = useRef<HTMLFormElement>(null);
  const [time, setTime] = useState("");
  const [adding, setAdding] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: VideoQuestionFormState, fd: FormData) => {
      const res = await createVideoQuestionAction(lessonId, prev, fd);
      if (res.ok) {
        formRef.current?.reset();
        setTime("");
        setAdding(false);
      }
      return res;
    },
    initial,
  );

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-line bg-bg p-4">
      <p className="text-sm font-semibold text-navy-800">{t("vqTitle")}</p>

      {questions.length === 0 ? (
        <p className="text-sm text-slate-500">{t("vqNone")}</p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 rounded-md border border-line bg-surface p-3"
            >
              <div className="min-w-0 text-sm">
                <p>
                  <span className="mr-2 rounded bg-gold-100 px-1.5 py-0.5 font-medium tabular-nums text-navy-800">
                    {q.time}
                  </span>
                  <span className="font-medium text-ink">{q.prompt}</span>
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                  {q.options.map((o, i) => (
                    <li key={i}>
                      {i === q.correctIndex ? "✓ " : "· "}
                      <span className={i === q.correctIndex ? "font-medium text-success" : ""}>
                        {o}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <form action={deleteAction.bind(null, q.id)}>
                <ConfirmSubmit label={t("vqDelete")} />
              </form>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          + {t("vqAdd")}
        </Button>
      ) : (
        <form ref={formRef} action={formAction} className="space-y-3">
          {state.error && <FormError message={t("vqError")} />}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("vqTime")}>
              <Input
                name="timestamp"
                value={time}
                onChange={(e) => setTime(maskTime(e.target.value))}
                placeholder="00:00:00"
                pattern="^\d{1,4}(:[0-5]?\d){0,2}$"
                inputMode="numeric"
                required
                className="tabular-nums"
              />
            </Field>
            <Field label={t("vqPromptUz")}>
              <Input name="promptUz" required maxLength={500} />
            </Field>
            <Field label={t("vqPromptRu")}>
              <Input name="promptRu" maxLength={500} />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t("vqCorrectHint")}</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctIndex"
                  value={i}
                  defaultChecked={i === 0}
                  className="size-4 shrink-0 accent-navy-800"
                  aria-label={`${t("vqCorrectHint")} ${i + 1}`}
                />
                <Input
                  name={`option${i}Uz`}
                  placeholder={`${t("vqOption")} ${i + 1} (UZ)${i < 2 ? " *" : ""}`}
                  required={i < 2}
                  maxLength={300}
                />
                <Input
                  name={`option${i}Ru`}
                  placeholder={`${t("vqOption")} ${i + 1} (RU)`}
                  maxLength={300}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {t("vqAdd")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
